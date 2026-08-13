/**
 * Clone the latest real monitoring day into a rolling N-day history window
 * so Overview trend / future环比 have multi-day facts.
 *
 * - Template = date with the most answer_observations (real import)
 * - Target window = [today - (days-1), today]
 * - Skips days that already have non-simulated rows
 * - Does NOT copy answer_text (keeps DB lean); marks raw_path = simulated:...
 * - Light deterministic noise so coverage drifts instead of flat lines
 *
 * Usage:
 *   node --env-file=.env.local scripts/simulate-history.mjs
 *   node --env-file=.env.local scripts/simulate-history.mjs --days=60
 *   node --env-file=.env.local scripts/simulate-history.mjs --replace
 */
import { createHash, randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
import { rebuildWorkspaceDay } from "./lib/rebuild-daily.mjs";

const SIM_PREFIX = "simulated:";

function databaseUrl() {
  const url = (process.env.DATABASE_URL ?? "").trim();
  if (!url) throw new Error("DATABASE_URL is required");
  return url;
}

function parseArgs(argv) {
  let days = 60;
  let replace = false;
  for (const arg of argv) {
    if (arg === "--replace") replace = true;
    else if (arg.startsWith("--days=")) days = Math.max(2, Number(arg.slice(7)) || 60);
  }
  return { days, replace };
}

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYmd(s) {
  const [y, m, d] = String(s).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d, n) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

function nowMysql() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, "0")}`;
}

/** Deterministic PRNG from string seed. */
function mulberry32(seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let t = h >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hashShort(s) {
  return createHash("sha1").update(s).digest("hex").slice(0, 12);
}

async function connect() {
  const u = new URL(databaseUrl());
  return mysql.createConnection({
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
    dateStrings: true,
    multipleStatements: false,
  });
}

async function deleteSimulated(conn) {
  const [obs] = await conn.query(
    `SELECT id FROM answer_observations WHERE raw_path LIKE ${conn.escape(SIM_PREFIX + "%")}`,
  );
  const ids = obs.map((r) => r.id);
  if (ids.length === 0) {
    console.log("no prior simulated rows");
    return;
  }
  console.log(`removing ${ids.length} simulated observations…`);
  const chunk = 400;
  for (let i = 0; i < ids.length; i += chunk) {
    const part = ids.slice(i, i + chunk);
    const inList = part.map((id) => conn.escape(id)).join(",");
    await conn.query(
      `DELETE cc FROM citation_competitors cc
       INNER JOIN citation_events ce ON ce.id = cc.event_id
       WHERE ce.observation_id IN (${inList})`,
    );
    await conn.query(`DELETE FROM citation_events WHERE observation_id IN (${inList})`);
    await conn.query(`DELETE FROM answer_brand_mentions WHERE observation_id IN (${inList})`);
    await conn.query(`DELETE FROM answer_observations WHERE id IN (${inList})`);
  }
}

async function loadTemplate(conn) {
  const [dates] = await conn.query(`
    SELECT observed_on AS d, COUNT(*) AS n
    FROM answer_observations
    WHERE raw_path IS NULL OR raw_path NOT LIKE ${conn.escape(SIM_PREFIX + "%")}
    GROUP BY observed_on
    ORDER BY n DESC, observed_on DESC
    LIMIT 1
  `);
  if (!dates.length) throw new Error("no real observations to clone");
  const templateDate = String(dates[0].d).slice(0, 10);
  console.log(`template date=${templateDate} rows=${dates[0].n}`);

  const [observations] = await conn.query(
    `SELECT id, workspace_id, prompt_id, engine_id, market, model, channel
     FROM answer_observations
     WHERE observed_on = ?
       AND (raw_path IS NULL OR raw_path NOT LIKE ?)
     ORDER BY id`,
    [templateDate, `${SIM_PREFIX}%`],
  );

  const obsIds = observations.map((o) => o.id);
  const mentions = [];
  const cites = [];
  const citeComps = [];
  const chunk = 500;
  for (let i = 0; i < obsIds.length; i += chunk) {
    const part = obsIds.slice(i, i + chunk);
    const inList = part.map((id) => conn.escape(id)).join(",");
    const [m] = await conn.query(
      `SELECT observation_id, brand_id, mentioned, position, sentiment
       FROM answer_brand_mentions WHERE observation_id IN (${inList})`,
    );
    mentions.push(...m);
    const [c] = await conn.query(
      `SELECT id, observation_id, url, title, position, domain, domain_category,
              brand_mentioned_on_page, times_cited
       FROM citation_events WHERE observation_id IN (${inList})`,
    );
    cites.push(...c);
  }

  const citeIds = cites.map((c) => c.id);
  for (let i = 0; i < citeIds.length; i += chunk) {
    const part = citeIds.slice(i, i + chunk);
    if (!part.length) continue;
    const inList = part.map((id) => conn.escape(id)).join(",");
    const [cc] = await conn.query(
      `SELECT event_id, brand_id FROM citation_competitors WHERE event_id IN (${inList})`,
    );
    citeComps.push(...cc);
  }

  const mentionsByObs = new Map();
  for (const m of mentions) {
    const list = mentionsByObs.get(m.observation_id) ?? [];
    list.push(m);
    mentionsByObs.set(m.observation_id, list);
  }
  const citesByObs = new Map();
  for (const c of cites) {
    const list = citesByObs.get(c.observation_id) ?? [];
    list.push(c);
    citesByObs.set(c.observation_id, list);
  }
  const compsByEvent = new Map();
  for (const cc of citeComps) {
    const list = compsByEvent.get(cc.event_id) ?? [];
    list.push(cc.brand_id);
    compsByEvent.set(cc.event_id, list);
  }

  // primary brand per workspace for drift direction
  const [primaries] = await conn.query(`
    SELECT workspace_id, id AS brand_id
    FROM workspace_brands WHERE role = 'primary'
  `);
  const primaryByWs = new Map(primaries.map((p) => [p.workspace_id, p.brand_id]));

  return {
    templateDate,
    observations,
    mentionsByObs,
    citesByObs,
    compsByEvent,
    primaryByWs,
  };
}

async function existingRealDates(conn, start, end) {
  const [rows] = await conn.query(
    `SELECT DISTINCT observed_on AS d
     FROM answer_observations
     WHERE observed_on BETWEEN ? AND ?
       AND (raw_path IS NULL OR raw_path NOT LIKE ?)
     ORDER BY observed_on`,
    [start, end, `${SIM_PREFIX}%`],
  );
  return new Set(rows.map((r) => String(r.d).slice(0, 10)));
}

async function insertBatches(conn, sql, rows, batchSize = 300) {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += batchSize) {
    const part = rows.slice(i, i + batchSize);
    await conn.query(sql, [part]);
  }
}

async function main() {
  const { days, replace } = parseArgs(process.argv.slice(2));
  const conn = await connect();
  const ts = nowMysql();

  try {
    if (replace) await deleteSimulated(conn);

    const tpl = await loadTemplate(conn);
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = addDays(end, -(days - 1));
    const startStr = ymd(start);
    const endStr = ymd(end);
    console.log(`window ${startStr} → ${endStr} (${days} days)`);

    const keepDates = await existingRealDates(conn, startStr, endStr);
    console.log(`keeping real dates: ${[...keepDates].join(", ") || "(none)"}`);

    let writtenObs = 0;
    let writtenMentions = 0;
    let writtenCites = 0;
    let writtenComps = 0;
    let daysWritten = 0;

    for (let offset = 0; offset < days; offset++) {
      const day = addDays(start, offset);
      const dateStr = ymd(day);
      if (keepDates.has(dateStr)) continue;

      // progress through window: 0 at start → 1 at end (mild upward primary coverage)
      const progress = days <= 1 ? 1 : offset / (days - 1);
      const rand = mulberry32(`orbis-sim|${dateStr}|${tpl.templateDate}`);

      const obsRows = [];
      const mentionRows = [];
      const citeRows = [];
      const compRows = [];

      for (const obs of tpl.observations) {
        const newObsId = randomUUID();
        const runTs = `sim${dateStr.replace(/-/g, "")}`;
        obsRows.push([
          newObsId,
          obs.workspace_id,
          obs.prompt_id,
          obs.engine_id,
          obs.market,
          dateStr,
          null,
          `${SIM_PREFIX}${tpl.templateDate}:${obs.id}:${hashShort(dateStr + obs.id)}`,
          obs.model || "",
          obs.channel || "simulated",
          runTs,
          ts,
          ts,
        ]);

        const primaryId = tpl.primaryByWs.get(obs.workspace_id);
        for (const m of tpl.mentionsByObs.get(obs.id) ?? []) {
          let mentioned = Number(m.mentioned) ? 1 : 0;
          const isPrimary = m.brand_id === primaryId;
          const roll = rand();
          // Earlier days: primary slightly less visible; competitors slightly more.
          if (isPrimary) {
            if (mentioned && roll < 0.12 * (1 - progress)) mentioned = 0;
            else if (!mentioned && roll < 0.1 * progress) mentioned = 1;
          } else {
            if (mentioned && roll < 0.08 * progress) mentioned = 0;
            else if (!mentioned && roll < 0.1 * (1 - progress)) mentioned = 1;
          }
          let position = m.position;
          if (mentioned) {
            const basePos = position == null ? 1 + Math.floor(rand() * 4) : Number(position);
            position = Math.max(1, Math.min(8, basePos + (rand() < 0.5 ? -1 : 1) * (rand() < 0.35 ? 1 : 0)));
          } else {
            position = null;
          }
          mentionRows.push([
            randomUUID(),
            newObsId,
            m.brand_id,
            mentioned,
            position,
            m.sentiment,
            ts,
            ts,
          ]);
        }

        for (const c of tpl.citesByObs.get(obs.id) ?? []) {
          // Drop some citations on early days; keep more toward recent.
          if (rand() < 0.18 * (1 - progress)) continue;
          const newCiteId = randomUUID();
          let brandOnPage = c.brand_mentioned_on_page;
          if (brandOnPage === "yes" && rand() < 0.1 * (1 - progress)) brandOnPage = "no";
          else if (brandOnPage === "no" && rand() < 0.08 * progress) brandOnPage = "yes";
          citeRows.push([
            newCiteId,
            newObsId,
            c.url,
            c.title ?? "",
            Number(c.position) || 0,
            c.domain ?? "",
            c.domain_category ?? "",
            brandOnPage || "na",
            Number(c.times_cited) || 1,
            ts,
            ts,
          ]);
          for (const brandId of tpl.compsByEvent.get(c.id) ?? []) {
            if (rand() < 0.12 * (1 - progress)) continue;
            compRows.push([newCiteId, brandId]);
          }
        }
      }

      await conn.beginTransaction();
      try {
        await insertBatches(
          conn,
          `INSERT INTO answer_observations
            (id, workspace_id, prompt_id, engine_id, market, observed_on,
             answer_text, raw_path, model, channel, run_ts, created_at, updated_at)
           VALUES ?`,
          obsRows,
        );
        await insertBatches(
          conn,
          `INSERT INTO answer_brand_mentions
            (id, observation_id, brand_id, mentioned, position, sentiment, created_at, updated_at)
           VALUES ?`,
          mentionRows,
        );
        await insertBatches(
          conn,
          `INSERT INTO citation_events
            (id, observation_id, url, title, position, domain, domain_category,
             brand_mentioned_on_page, times_cited, created_at, updated_at)
           VALUES ?`,
          citeRows,
        );
        await insertBatches(
          conn,
          `INSERT INTO citation_competitors (event_id, brand_id) VALUES ?`,
          compRows,
        );
        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      }

      const wsIds = [...new Set(obsRows.map((r) => r[1]))];
      for (const wsId of wsIds) {
        await rebuildWorkspaceDay(conn, wsId, dateStr);
      }

      writtenObs += obsRows.length;
      writtenMentions += mentionRows.length;
      writtenCites += citeRows.length;
      writtenComps += compRows.length;
      daysWritten += 1;
      if (daysWritten % 5 === 0 || offset === days - 1) {
        console.log(
          `  ${dateStr}: +${obsRows.length} obs (day ${daysWritten}, progress ${(progress * 100).toFixed(0)}%)`,
        );
      }
    }

    const [check] = await conn.query(`
      SELECT observed_on AS d, COUNT(*) AS n,
        SUM(CASE WHEN raw_path LIKE ${conn.escape(SIM_PREFIX + "%")} THEN 1 ELSE 0 END) AS sim
      FROM answer_observations
      GROUP BY observed_on
      ORDER BY observed_on
    `);
    console.log("\nsummary");
    console.log({
      daysWritten,
      writtenObs,
      writtenMentions,
      writtenCites,
      writtenComps,
      distinctDates: check.length,
    });
    console.log(
      "date span:",
      check[0]?.d,
      "→",
      check[check.length - 1]?.d,
      `(${check.length} days)`,
    );
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
