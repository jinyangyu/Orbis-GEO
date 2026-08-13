/**
 * Create L3 tables (if needed) and rebuild daily rollups from L2.
 *
 * Usage:
 *   node --env-file=.env.local scripts/rebuild-metrics-daily.mjs
 *   node --env-file=.env.local scripts/rebuild-metrics-daily.mjs --workspace=<uuid>
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import {
  listObservationDays,
  rebuildMany,
} from "./lib/rebuild-daily.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function databaseUrl() {
  const url = (process.env.DATABASE_URL ?? "").trim();
  if (!url) throw new Error("DATABASE_URL is required");
  return url;
}

function parseArgs(argv) {
  let workspaceId = null;
  for (const arg of argv) {
    if (arg.startsWith("--workspace=")) workspaceId = arg.slice(12);
  }
  return { workspaceId };
}

async function main() {
  const { workspaceId } = parseArgs(process.argv.slice(2));
  const u = new URL(databaseUrl());
  const conn = await mysql.createConnection({
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
    dateStrings: true,
    multipleStatements: true,
  });

  try {
    const ddl = readFileSync(
      path.join(__dirname, "create-metrics-daily.sql"),
      "utf8",
    );
    await conn.query(ddl);
    console.log("L3 tables ready");

    const pairs = await listObservationDays(conn, workspaceId);
    console.log(
      `rebuilding ${pairs.length} workspace-days` +
        (workspaceId ? ` (workspace ${workspaceId})` : " (all)"),
    );

    const stats = await rebuildMany(conn, pairs, (i, n, ws, date) => {
      if (i % 20 === 0 || i === n) {
        console.log(`  ${i}/${n} ${ws.slice(0, 8)}… ${date}`);
      }
    });
    console.log("done", stats);

    const [[check]] = await conn.query(`
      SELECT
        (SELECT COUNT(*) FROM obs_metrics_daily) AS obs_days,
        (SELECT COUNT(*) FROM brand_metrics_daily) AS brand_rows,
        (SELECT COUNT(*) FROM prompt_metrics_daily) AS prompt_rows,
        (SELECT COUNT(*) FROM domain_metrics_daily) AS domain_rows,
        (SELECT COUNT(*) FROM url_metrics_daily) AS url_rows
    `);
    console.log("table counts", check);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
