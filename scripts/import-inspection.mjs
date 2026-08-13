/**
 * Import inspection raw response.json dumps into L2 fact tables.
 *
 * Usage:
 *   node --env-file=.env.local scripts/import-inspection.mjs [dataRoot]
 *
 * Default dataRoot:
 *   ~/Downloads/inspection_2026-08-05_all_raw_responses_v2
 *
 * Idempotent for the same grain (workspace × prompt × engine × market × day):
 * later run_ts overwrites answer_text / citations / primary mention.
 */
import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";
import {
  listObservationDays,
  rebuildMany,
} from "./lib/rebuild-daily.mjs";

const DEFAULT_DATA_ROOT = path.join(
  process.env.HOME ?? "",
  "Downloads/inspection_2026-08-05_all_raw_responses_v2",
);

function databaseUrl() {
  const url = (process.env.DATABASE_URL ?? "").trim();
  if (!url) {
    throw new Error("DATABASE_URL is required (e.g. via --env-file=.env.local)");
  }
  return url;
}

function connectionOptions() {
  const parsed = new URL(databaseUrl());
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ""),
    multipleStatements: true,
  };
}

function dashify(value) {
  return String(value).replaceAll(".", "-");
}

function normalizeDomain(input) {
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .replace(/:\d+$/, "");
}

function domainFromUrl(url) {
  try {
    return normalizeDomain(new URL(url).hostname);
  } catch {
    return "";
  }
}

function truncate(value, max) {
  const s = String(value ?? "");
  return s.length <= max ? s : s.slice(0, max);
}

function slugFromDomain(domain) {
  const slug = domain
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/\.+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 180);
  return slug || "workspace";
}

/** Deterministic UUID from a string (v5-like). */
function uuidFromKey(key) {
  const hex = createHash("sha256").update(key).digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `a${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

function observedOnFromRunTs(runTs) {
  // 20260805T040017 → 2026-08-05
  const m = /^(\d{4})(\d{2})(\d{2})T/.exec(runTs);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function parseBatchIndexCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });
    return row;
  });
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function folderSuffix(brand, domain) {
  return `-${dashify(brand)}-${dashify(domain)}`;
}

function extractPrompt(folderName, brand, domain) {
  // search_{hash}_{prompt}-{brand}-{domain}
  const m = /^search_[0-9a-f]+_(.+)$/i.exec(folderName);
  if (!m) return null;
  const rest = m[1];
  const suf = folderSuffix(brand, domain);
  if (rest.endsWith(suf)) {
    return rest.slice(0, -suf.length);
  }
  // Truncated filesystem names: cut at last -{brand_dashed}
  const brandTok = `-${dashify(brand)}`;
  const idx = rest.lastIndexOf(brandTok);
  if (idx > 0) return rest.slice(0, idx);
  return null;
}

function extractAnswerText(payload) {
  const chat = payload?.choices?.[0]?.message?.content;
  if (typeof chat === "string" && chat.trim()) return chat;

  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  if (Array.isArray(payload?.output)) {
    const parts = [];
    for (const item of payload.output) {
      if (item?.type !== "message") continue;
      if (!Array.isArray(item.content)) continue;
      for (const block of item.content) {
        if (
          (block?.type === "output_text" || block?.type === "text") &&
          typeof block.text === "string"
        ) {
          parts.push(block.text);
        }
      }
    }
    if (parts.length) return parts.join("\n");
  }

  if (typeof payload?.content === "string" && payload.content.trim()) {
    return payload.content;
  }
  return "";
}

function parseCitations(content) {
  const citations = [];
  const re = /\[(\d+)\]\s*([^:\n]+?):\s*(https?:\/\/\S+)/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    const position = Number(match[1]);
    const title = match[2].trim();
    let url = match[3].trim().replace(/[),.;]+$/, "");
    citations.push({
      position: Number.isFinite(position) ? position : citations.length + 1,
      title: truncate(title, 512),
      url: truncate(url, 512),
      domain: truncate(domainFromUrl(url), 255),
    });
  }
  return citations;
}

function brandMentionedInText(content, brandName, brandDomain) {
  const text = content.toLowerCase();
  const name = brandName.trim().toLowerCase();
  const domain = brandDomain.trim().toLowerCase();
  if (name && text.includes(name)) return true;
  if (domain && text.includes(domain)) return true;
  const bare = domain.replace(/\.[a-z]{2,}$/i, "");
  if (bare.length >= 3 && text.includes(bare)) return true;
  return false;
}

function providerFromModel(model, fallback) {
  const m = (model ?? "").toLowerCase();
  if (m.includes("deepseek")) return "deepseek";
  if (m.includes("doubao") || m.includes("seed")) return "doubao";
  if (m.includes("gpt") || m.includes("openai")) return "gpt";
  return fallback || "gpt";
}

async function findBatchIndex(dataRoot) {
  const candidates = [];
  async function walk(dir, depth) {
    if (depth > 8) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isFile() && ent.name === "batch_index.csv") {
        candidates.push(full);
      } else if (ent.isDirectory() && !ent.name.startsWith(".")) {
        await walk(full, depth + 1);
      }
    }
  }
  await walk(path.join(dataRoot, "output"), 0);
  if (candidates.length === 0) await walk(dataRoot, 0);
  candidates.sort();
  return candidates[candidates.length - 1] ?? null;
}

async function ensureSchema(conn) {
  const columns = [
    ["answer_text", "MEDIUMTEXT NULL"],
    ["raw_path", "VARCHAR(512) NULL"],
    ["model", "VARCHAR(128) NOT NULL DEFAULT ''"],
    ["channel", "VARCHAR(64) NOT NULL DEFAULT ''"],
    ["run_ts", "VARCHAR(32) NOT NULL DEFAULT ''"],
  ];
  const [existing] = await conn.query(
    `SELECT COLUMN_NAME AS name
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'answer_observations'`,
  );
  const have = new Set(existing.map((r) => r.name));
  for (const [name, ddl] of columns) {
    if (have.has(name)) continue;
    await conn.query(
      `ALTER TABLE answer_observations ADD COLUMN ${name} ${ddl}`,
    );
  }

  // Align char collations with workspaces/prompts (utf8mb4_unicode_ci) for JOINs.
  await conn.query(`
    ALTER TABLE answer_observations
      CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await conn.query(`
    ALTER TABLE engines
      CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await conn.query(`
    ALTER TABLE workspace_brands
      CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await conn.query(`
    ALTER TABLE citation_events
      CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await conn.query(`
    ALTER TABLE answer_brand_mentions
      CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
}

async function seedEngines(conn) {
  const engines = [
    ["chatgpt", "ChatGPT", 1],
    ["perplexity", "Perplexity", 2],
    ["google", "Google AI", 3],
    ["gemini", "Gemini", 4],
    ["copilot", "Copilot", 5],
    ["deepseek", "DeepSeek", 6],
    ["doubao", "Doubao", 7],
    ["gpt", "GPT", 8],
  ];
  for (const [code, name, sortOrder] of engines) {
    const id = uuidFromKey(`engine:${code}`);
    await conn.query(
      `INSERT INTO engines (id, code, name, sort_order, is_active)
       SELECT ?, ?, ?, ?, 1 FROM DUAL
       WHERE NOT EXISTS (SELECT 1 FROM engines WHERE code = ?)`,
      [id, code, name, sortOrder, code],
    );
  }
  const [rows] = await conn.query("SELECT id, code FROM engines");
  return Object.fromEntries(rows.map((r) => [r.code, r.id]));
}

async function ensureWorkspace(conn, { brand, domain, market }) {
  const slug = slugFromDomain(domain);
  const userId = uuidFromKey(`import-user:${domain}`);
  const workspaceId = uuidFromKey(`import-ws:${domain}`);
  const brandId = uuidFromKey(`import-brand:${domain}`);

  await conn.query(
    `INSERT INTO users (id, email, first_name, last_name, role, source)
     SELECT ?, ?, 'Import', ?, 'brand', 'inspection-import' FROM DUAL
     WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = ?)`,
    [userId, `import+${slug}@orbis.local`, brand.slice(0, 100), userId],
  );

  const [existingWs] = await conn.query(
    "SELECT id FROM workspaces WHERE slug = ? LIMIT 1",
    [slug],
  );
  let wsId = existingWs[0]?.id;
  if (!wsId) {
    // Prefer deterministic id; fall back if owner already has another workspace
    try {
      await conn.query(
        `INSERT INTO workspaces (id, owner_user_id, name, slug, onboarding_completed_at)
         VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3))`,
        [workspaceId, userId, brand.slice(0, 200), slug],
      );
      wsId = workspaceId;
    } catch (err) {
      if (err.code !== "ER_DUP_ENTRY") throw err;
      const [again] = await conn.query(
        "SELECT id FROM workspaces WHERE slug = ? OR owner_user_id = ? LIMIT 1",
        [slug, userId],
      );
      wsId = again[0]?.id;
      if (!wsId) throw err;
    }
  }

  const [existingBrand] = await conn.query(
    `SELECT id FROM workspace_brands
     WHERE workspace_id = ? AND domain = ? LIMIT 1`,
    [wsId, domain],
  );
  let primaryBrandId = existingBrand[0]?.id;
  if (!primaryBrandId) {
    await conn.query(
      `INSERT INTO workspace_brands
        (id, workspace_id, name, domain, role, market, language, sort_order)
       VALUES (?, ?, ?, ?, 'primary', ?, '', 0)`,
      [brandId, wsId, brand.slice(0, 200), domain, market],
    );
    primaryBrandId = brandId;
  }

  return { workspaceId: wsId, primaryBrandId, slug };
}

async function ensurePrompt(conn, workspaceId, text, market) {
  const [existing] = await conn.query(
    `SELECT id FROM prompts WHERE workspace_id = ? AND text = ? LIMIT 1`,
    [workspaceId, text],
  );
  if (existing[0]?.id) return existing[0].id;

  const id = randomUUID();
  const [countRows] = await conn.query(
    "SELECT COUNT(*) AS c FROM prompts WHERE workspace_id = ?",
    [workspaceId],
  );
  const sortOrder = Number(countRows[0]?.c ?? 0);
  await conn.query(
    `INSERT INTO prompts
      (id, workspace_id, text, sort_order, source, is_active, market, tags)
     VALUES (?, ?, ?, ?, 'inspection', 1, ?, JSON_ARRAY())`,
    [id, workspaceId, text, sortOrder, market],
  );
  return id;
}

async function upsertObservation(conn, row) {
  const [existing] = await conn.query(
    `SELECT id, run_ts FROM answer_observations
     WHERE workspace_id = ? AND prompt_id = ? AND engine_id = ?
       AND market = ? AND observed_on = ?
     LIMIT 1`,
    [
      row.workspaceId,
      row.promptId,
      row.engineId,
      row.market,
      row.observedOn,
    ],
  );

  if (existing[0]) {
    // Keep newer run_ts only
    if (existing[0].run_ts && row.runTs < existing[0].run_ts) {
      return { id: existing[0].id, skipped: true };
    }
    await conn.query(
      `UPDATE answer_observations
       SET answer_text = ?, raw_path = ?, model = ?, channel = ?, run_ts = ?
       WHERE id = ?`,
      [
        row.answerText,
        row.rawPath,
        row.model,
        row.channel,
        row.runTs,
        existing[0].id,
      ],
    );
    await conn.query(
      "DELETE FROM citation_events WHERE observation_id = ?",
      [existing[0].id],
    );
    await conn.query(
      "DELETE FROM answer_brand_mentions WHERE observation_id = ?",
      [existing[0].id],
    );
    return { id: existing[0].id, skipped: false, updated: true };
  }

  const id = randomUUID();
  await conn.query(
    `INSERT INTO answer_observations
      (id, workspace_id, prompt_id, engine_id, market, observed_on,
       answer_text, raw_path, model, channel, run_ts)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      row.workspaceId,
      row.promptId,
      row.engineId,
      row.market,
      row.observedOn,
      row.answerText,
      row.rawPath,
      row.model,
      row.channel,
      row.runTs,
    ],
  );
  return { id, skipped: false, updated: false };
}

async function insertCitations(conn, observationId, citations) {
  for (const c of citations) {
    if (!c.url) continue;
    await conn.query(
      `INSERT INTO citation_events
        (id, observation_id, url, title, position, domain, domain_category,
         brand_mentioned_on_page, times_cited)
       VALUES (?, ?, ?, ?, ?, ?, '', 'na', 1)
       ON DUPLICATE KEY UPDATE
         title = VALUES(title),
         position = VALUES(position),
         domain = VALUES(domain)`,
      [
        randomUUID(),
        observationId,
        c.url,
        c.title,
        c.position,
        c.domain,
      ],
    );
  }
}

async function insertPrimaryMention(conn, observationId, brandId, mentioned) {
  await conn.query(
    `INSERT INTO answer_brand_mentions
      (id, observation_id, brand_id, mentioned, position, sentiment)
     VALUES (?, ?, ?, ?, NULL, NULL)
     ON DUPLICATE KEY UPDATE mentioned = VALUES(mentioned)`,
    [randomUUID(), observationId, brandId, mentioned ? 1 : 0],
  );
}

async function loadBatchMeta(dataRoot) {
  const batchPath = await findBatchIndex(dataRoot);
  if (!batchPath) {
    throw new Error(`batch_index.csv not found under ${dataRoot}`);
  }
  const text = await readFile(batchPath, "utf8");
  const rows = parseBatchIndexCsv(text);
  const byTs = new Map();
  const knownPairs = [];
  for (const row of rows) {
    if (row.latest_run_ts) {
      byTs.set(row.latest_run_ts, {
        brand: row.brand,
        brandDomain: normalizeDomain(row.brand_domain || row.brand),
        country: (row.country || "").toLowerCase(),
        provider: (row.provider || "").toLowerCase(),
        jobName: row.job_name || row.batch || "",
      });
    }
    knownPairs.push({
      brand: row.brand,
      brandDomain: normalizeDomain(row.brand_domain || row.brand),
      country: (row.country || "").toLowerCase(),
    });
  }
  return { batchPath, byTs, knownPairs };
}

async function inferMeta(runDir, folderSample, knownPairs, byTs) {
  if (byTs.has(runDir)) return byTs.get(runDir);
  const rest = folderSample.replace(/^search_[0-9a-f]+_/i, "");
  for (const pair of knownPairs) {
    const suf = folderSuffix(pair.brand, pair.brandDomain);
    if (rest.endsWith(suf) || rest.includes(`-${dashify(pair.brand)}-`)) {
      return {
        brand: pair.brand,
        brandDomain: pair.brandDomain,
        country: pair.country,
        provider: "",
        jobName: `inferred:${runDir}`,
      };
    }
  }
  return null;
}

async function listRunDirs(dataRoot) {
  const entries = await readdir(dataRoot, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && /^\d{8}T\d{6}$/.test(e.name))
    .map((e) => e.name)
    .sort();
}

async function main() {
  const dataRoot = path.resolve(process.argv[2] || DEFAULT_DATA_ROOT);
  const rootStat = await stat(dataRoot).catch(() => null);
  if (!rootStat?.isDirectory()) {
    throw new Error(`Data root not found: ${dataRoot}`);
  }

  console.log(`Importing from ${dataRoot}`);
  const { batchPath, byTs, knownPairs } = await loadBatchMeta(dataRoot);
  console.log(`batch_index: ${batchPath} (${byTs.size} runs indexed)`);

  const conn = await mysql.createConnection(connectionOptions());
  const stats = {
    files: 0,
    inserted: 0,
    updated: 0,
    skippedOlder: 0,
    parseFail: 0,
    citations: 0,
    mentions: 0,
    errors: 0,
  };

  try {
    await ensureSchema(conn);
    const engineIds = await seedEngines(conn);
    console.log(`engines ready: ${Object.keys(engineIds).join(", ")}`);

    const workspaceCache = new Map();
    const touchedDays = new Set();
    const runDirs = await listRunDirs(dataRoot);

    for (const runTs of runDirs) {
      const channelDir = path.join(dataRoot, runTs, "chatgpt-search");
      let folders;
      try {
        folders = await readdir(channelDir, { withFileTypes: true });
      } catch {
        console.warn(`skip run (no chatgpt-search): ${runTs}`);
        continue;
      }

      const searchFolders = folders.filter(
        (f) => f.isDirectory() && f.name.startsWith("search_"),
      );
      if (searchFolders.length === 0) continue;

      let meta = await inferMeta(
        runTs,
        searchFolders[0].name,
        knownPairs,
        byTs,
      );
      if (!meta) {
        console.warn(`skip run (no brand meta): ${runTs}`);
        continue;
      }

      const observedOn = observedOnFromRunTs(runTs);
      if (!observedOn) {
        console.warn(`skip run (bad run_ts): ${runTs}`);
        continue;
      }

      const market = meta.country || "";
      const cacheKey = meta.brandDomain;
      if (!workspaceCache.has(cacheKey)) {
        workspaceCache.set(
          cacheKey,
          await ensureWorkspace(conn, {
            brand: meta.brand,
            domain: meta.brandDomain,
            market,
          }),
        );
      }
      const { workspaceId, primaryBrandId } = workspaceCache.get(cacheKey);
      touchedDays.add(`${workspaceId}|${observedOn}`);

      for (const folder of searchFolders) {
        stats.files += 1;
        const promptText = extractPrompt(
          folder.name,
          meta.brand,
          meta.brandDomain,
        );
        if (!promptText) {
          stats.parseFail += 1;
          continue;
        }

        const responsePath = path.join(channelDir, folder.name, "response.json");
        let payload;
        try {
          payload = JSON.parse(await readFile(responsePath, "utf8"));
        } catch (err) {
          stats.errors += 1;
          console.warn(`read fail ${responsePath}: ${err.message}`);
          continue;
        }

        const content = extractAnswerText(payload);
        if (typeof content !== "string" || !content.trim()) {
          stats.errors += 1;
          continue;
        }

        const model = String(payload?.model ?? "");
        const provider = providerFromModel(model, meta.provider);
        const engineId = engineIds[provider];
        if (!engineId) {
          stats.errors += 1;
          console.warn(`unknown provider ${provider} for ${responsePath}`);
          continue;
        }

        const promptId = await ensurePrompt(
          conn,
          workspaceId,
          promptText,
          market,
        );

        const relPath = path.relative(dataRoot, responsePath);
        const obs = await upsertObservation(conn, {
          workspaceId,
          promptId,
          engineId,
          market,
          observedOn,
          answerText: content,
          rawPath: truncate(relPath, 512),
          model: truncate(model, 128),
          channel: "chatgpt-search",
          runTs,
        });

        if (obs.skipped) {
          stats.skippedOlder += 1;
          continue;
        }
        if (obs.updated) stats.updated += 1;
        else stats.inserted += 1;

        const citations = parseCitations(content);
        await insertCitations(conn, obs.id, citations);
        stats.citations += citations.length;

        const mentioned = brandMentionedInText(
          content,
          meta.brand,
          meta.brandDomain,
        );
        await insertPrimaryMention(conn, obs.id, primaryBrandId, mentioned);
        stats.mentions += 1;
      }

      console.log(
        `run ${runTs} ${meta.brand}/${meta.brandDomain} provider≈${meta.provider || "infer"} folders=${searchFolders.length}`,
      );
    }

    const [obsCount] = await conn.query(
      "SELECT COUNT(*) AS c FROM answer_observations",
    );
    const [citeCount] = await conn.query(
      "SELECT COUNT(*) AS c FROM citation_events",
    );
    const [mentionCount] = await conn.query(
      "SELECT COUNT(*) AS c FROM answer_brand_mentions",
    );
    const slugs = [...workspaceCache.values()].map((w) => w.slug);
    let wsCount = [];
    if (slugs.length > 0) {
      const [rows] = await conn.query(
        `SELECT w.slug, w.name, COUNT(o.id) AS observations
         FROM workspaces w
         LEFT JOIN answer_observations o ON o.workspace_id = w.id
         WHERE w.slug IN (${slugs.map(() => "?").join(",")})
         GROUP BY w.id
         ORDER BY w.slug`,
        slugs,
      );
      wsCount = rows;
    }

    console.log("\nDone.");
    console.log(stats);
    console.log(`answer_observations total: ${obsCount[0].c}`);
    console.log(`citation_events total: ${citeCount[0].c}`);
    console.log(`answer_brand_mentions total: ${mentionCount[0].c}`);
    console.log("workspaces:", wsCount);

    if (touchedDays.size > 0) {
      const pairs = [...touchedDays].map((key) => {
        const [workspaceId, date] = key.split("|");
        return { workspaceId, date };
      });
      console.log(`\nRebuilding L3 daily for ${pairs.length} workspace-days…`);
      const dailyStats = await rebuildMany(conn, pairs, (i, n) => {
        if (i % 10 === 0 || i === n) console.log(`  daily ${i}/${n}`);
      });
      console.log("L3 rebuild", dailyStats);
    } else {
      // Fallback: rebuild everything that has L2 rows
      const pairs = await listObservationDays(conn);
      if (pairs.length) {
        console.log(`\nRebuilding L3 daily for ${pairs.length} workspace-days…`);
        console.log(await rebuildMany(conn, pairs));
      }
    }
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
