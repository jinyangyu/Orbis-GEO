/**
 * Rebuild L3 daily rollups from L2 facts for one workspace × day.
 * Engine-agnostic (strategy A). Safe to call repeatedly (delete + insert).
 */
import { randomUUID } from "node:crypto";

function nowMysql() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, "0")}`;
}

function rootDomain(host) {
  const h = String(host ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .replace(/:\d+$/, "");
  const parts = h.split(".").filter(Boolean);
  if (parts.length <= 2) return h;
  const last2 = parts.slice(-2).join(".");
  if (["com.cn", "co.uk", "com.au", "co.jp", "com.mx"].includes(last2)) {
    return parts.slice(-3).join(".");
  }
  return last2;
}

async function insertBatches(conn, sql, rows, batchSize = 400) {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += batchSize) {
    await conn.query(sql, [rows.slice(i, i + batchSize)]);
  }
}

export async function deleteDailyForDay(conn, workspaceId, dateStr) {
  await conn.query(
    `DELETE FROM url_metrics_daily WHERE workspace_id = ? AND observed_on = ?`,
    [workspaceId, dateStr],
  );
  await conn.query(
    `DELETE FROM domain_metrics_daily WHERE workspace_id = ? AND observed_on = ?`,
    [workspaceId, dateStr],
  );
  await conn.query(
    `DELETE FROM prompt_metrics_daily WHERE workspace_id = ? AND observed_on = ?`,
    [workspaceId, dateStr],
  );
  await conn.query(
    `DELETE FROM brand_metrics_daily WHERE workspace_id = ? AND observed_on = ?`,
    [workspaceId, dateStr],
  );
  await conn.query(
    `DELETE FROM obs_metrics_daily WHERE workspace_id = ? AND observed_on = ?`,
    [workspaceId, dateStr],
  );
}

/**
 * Recompute all L3 rows for one workspace on one calendar day.
 * @returns {{ obs: number, brands: number, prompts: number, domains: number, urls: number }}
 */
export async function rebuildWorkspaceDay(conn, workspaceId, dateStr) {
  const ts = nowMysql();
  await deleteDailyForDay(conn, workspaceId, dateStr);

  const [[obsRow]] = await conn.query(
    `SELECT COUNT(*) AS c FROM answer_observations
     WHERE workspace_id = ? AND observed_on = ?`,
    [workspaceId, dateStr],
  );
  const obsCount = Number(obsRow?.c ?? 0);
  if (obsCount === 0) {
    return { obs: 0, brands: 0, prompts: 0, domains: 0, urls: 0 };
  }

  await conn.query(
    `INSERT INTO obs_metrics_daily
      (id, workspace_id, observed_on, obs_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [randomUUID(), workspaceId, dateStr, obsCount, ts, ts],
  );

  const [brandRows] = await conn.query(
    `SELECT
       abm.brand_id AS brand_id,
       SUM(CASE WHEN abm.mentioned = 1 THEN 1 ELSE 0 END) AS mentioned_obs,
       SUM(abm.mentioned) AS mention_sum,
       COALESCE(SUM(CASE WHEN abm.mentioned = 1 AND abm.position IS NOT NULL THEN abm.position ELSE 0 END), 0) AS position_sum,
       SUM(CASE WHEN abm.mentioned = 1 AND abm.position IS NOT NULL THEN 1 ELSE 0 END) AS position_n
     FROM answer_brand_mentions abm
     INNER JOIN answer_observations o ON o.id = abm.observation_id
     WHERE o.workspace_id = ? AND o.observed_on = ?
     GROUP BY abm.brand_id`,
    [workspaceId, dateStr],
  );
  const brandInserts = brandRows.map((r) => [
    randomUUID(),
    workspaceId,
    r.brand_id,
    dateStr,
    Number(r.mentioned_obs ?? 0),
    Number(r.mention_sum ?? 0),
    Number(r.position_sum ?? 0),
    Number(r.position_n ?? 0),
    ts,
    ts,
  ]);
  await insertBatches(
    conn,
    `INSERT INTO brand_metrics_daily
      (id, workspace_id, brand_id, observed_on, mentioned_obs, mention_sum,
       position_sum, position_n, created_at, updated_at)
     VALUES ?`,
    brandInserts,
  );

  const [[primary]] = await conn.query(
    `SELECT id, domain FROM workspace_brands
     WHERE workspace_id = ? AND role = 'primary' LIMIT 1`,
    [workspaceId],
  );
  const primaryId = primary?.id ?? null;
  const primaryDomain = primary?.domain ?? "";
  const root = rootDomain(primaryDomain);

  const [promptRows] = await conn.query(
    `SELECT
       o.prompt_id AS prompt_id,
       COUNT(DISTINCT o.id) AS obs_count,
       COUNT(DISTINCT CASE WHEN abm.mentioned = 1 THEN o.id END) AS primary_mentions
     FROM answer_observations o
     LEFT JOIN answer_brand_mentions abm
       ON abm.observation_id = o.id AND abm.brand_id = ?
     WHERE o.workspace_id = ? AND o.observed_on = ?
     GROUP BY o.prompt_id`,
    [primaryId, workspaceId, dateStr],
  );

  const [totalMentionRows] = await conn.query(
    `SELECT
       o.prompt_id AS prompt_id,
       SUM(abm.mentioned) AS total_brand_mentions
     FROM answer_observations o
     INNER JOIN answer_brand_mentions abm ON abm.observation_id = o.id
     WHERE o.workspace_id = ? AND o.observed_on = ? AND abm.mentioned = 1
     GROUP BY o.prompt_id`,
    [workspaceId, dateStr],
  );
  const totalByPrompt = new Map(
    totalMentionRows.map((r) => [r.prompt_id, Number(r.total_brand_mentions ?? 0)]),
  );

  let citeByPrompt = new Map();
  if (primaryDomain) {
    const [citeRows] = await conn.query(
      `SELECT
         o.prompt_id AS prompt_id,
         SUM(ce.times_cited) AS domain_cites
       FROM answer_observations o
       INNER JOIN citation_events ce ON ce.observation_id = o.id
       WHERE o.workspace_id = ? AND o.observed_on = ?
         AND (
           ce.domain = ?
           OR ce.domain LIKE ?
         )
       GROUP BY o.prompt_id`,
      [workspaceId, dateStr, primaryDomain, `%.${root}`],
    );
    citeByPrompt = new Map(
      citeRows.map((r) => [r.prompt_id, Number(r.domain_cites ?? 0)]),
    );
  }

  const promptInserts = promptRows.map((r) => [
    randomUUID(),
    workspaceId,
    r.prompt_id,
    dateStr,
    Number(r.obs_count ?? 0),
    Number(r.primary_mentions ?? 0),
    totalByPrompt.get(r.prompt_id) ?? 0,
    citeByPrompt.get(r.prompt_id) ?? 0,
    ts,
    ts,
  ]);
  await insertBatches(
    conn,
    `INSERT INTO prompt_metrics_daily
      (id, workspace_id, prompt_id, observed_on, obs_count, primary_mentions,
       total_brand_mentions, domain_cites, created_at, updated_at)
     VALUES ?`,
    promptInserts,
  );

  const [domainRows] = await conn.query(
    `SELECT
       ce.domain AS domain,
       COALESCE(NULLIF(MAX(ce.domain_category), ''), '其他') AS domain_category,
       SUM(ce.times_cited) AS citations,
       COUNT(DISTINCT o.prompt_id) AS prompts_hit
     FROM citation_events ce
     INNER JOIN answer_observations o ON o.id = ce.observation_id
     WHERE o.workspace_id = ? AND o.observed_on = ?
     GROUP BY ce.domain`,
    [workspaceId, dateStr],
  );
  const domainInserts = domainRows.map((r) => [
    randomUUID(),
    workspaceId,
    r.domain || "",
    dateStr,
    r.domain_category || "其他",
    Number(r.citations ?? 0),
    Number(r.prompts_hit ?? 0),
    ts,
    ts,
  ]);
  await insertBatches(
    conn,
    `INSERT INTO domain_metrics_daily
      (id, workspace_id, domain, observed_on, domain_category, citations,
       prompts_hit, created_at, updated_at)
     VALUES ?`,
    domainInserts,
  );

  const [urlRows] = await conn.query(
    `SELECT
       ce.url AS url,
       MAX(ce.title) AS title,
       ce.domain AS domain,
       COALESCE(NULLIF(MAX(ce.domain_category), ''), '其他') AS domain_category,
       SUM(ce.times_cited) AS citations,
       SUM(CASE WHEN ce.brand_mentioned_on_page = 'yes' THEN ce.times_cited ELSE 0 END) AS brand_on_page_yes
     FROM citation_events ce
     INNER JOIN answer_observations o ON o.id = ce.observation_id
     WHERE o.workspace_id = ? AND o.observed_on = ?
     GROUP BY ce.url, ce.domain`,
    [workspaceId, dateStr],
  );
  const urlInserts = urlRows.map((r) => [
    randomUUID(),
    workspaceId,
    r.url,
    dateStr,
    String(r.title ?? "").slice(0, 512),
    r.domain || "",
    r.domain_category || "其他",
    Number(r.citations ?? 0),
    Number(r.brand_on_page_yes ?? 0),
    ts,
    ts,
  ]);
  await insertBatches(
    conn,
    `INSERT INTO url_metrics_daily
      (id, workspace_id, url, observed_on, title, domain, domain_category,
       citations, brand_on_page_yes, created_at, updated_at)
     VALUES ?`,
    urlInserts,
  );

  return {
    obs: obsCount,
    brands: brandInserts.length,
    prompts: promptInserts.length,
    domains: domainInserts.length,
    urls: urlInserts.length,
  };
}

/** List distinct (workspace_id, observed_on) pairs present in L2. */
export async function listObservationDays(conn, workspaceId) {
  if (workspaceId) {
    const [rows] = await conn.query(
      `SELECT DISTINCT observed_on AS d
       FROM answer_observations
       WHERE workspace_id = ?
       ORDER BY observed_on`,
      [workspaceId],
    );
    return rows.map((r) => ({
      workspaceId,
      date: String(r.d).slice(0, 10),
    }));
  }
  const [rows] = await conn.query(
    `SELECT DISTINCT workspace_id AS workspace_id, observed_on AS d
     FROM answer_observations
     ORDER BY workspace_id, observed_on`,
  );
  return rows.map((r) => ({
    workspaceId: r.workspace_id,
    date: String(r.d).slice(0, 10),
  }));
}

/** Rebuild many days; returns aggregate stats. */
export async function rebuildMany(conn, pairs, onProgress) {
  const stats = { days: 0, obs: 0, brands: 0, prompts: 0, domains: 0, urls: 0 };
  for (let i = 0; i < pairs.length; i++) {
    const { workspaceId, date } = pairs[i];
    const part = await rebuildWorkspaceDay(conn, workspaceId, date);
    stats.days += 1;
    stats.obs += part.obs;
    stats.brands += part.brands;
    stats.prompts += part.prompts;
    stats.domains += part.domains;
    stats.urls += part.urls;
    if (onProgress) onProgress(i + 1, pairs.length, workspaceId, date, part);
  }
  return stats;
}

/** After L2 writes: rebuild each distinct day touched. */
export async function rebuildTouchedDays(conn, workspaceId, dateSet) {
  const dates = [...dateSet].filter(Boolean).sort();
  for (const date of dates) {
    await rebuildWorkspaceDay(conn, workspaceId, date);
  }
  return dates.length;
}
