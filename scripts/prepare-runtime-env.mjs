/**
 * Load this machine's .env.local, refuse to start without a working DATABASE_URL,
 * and write .dev.vars so vinext/wrangler actually sees the secrets (PM2 env alone
 * does not reach the Worker isolate).
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const require = createRequire(import.meta.url);
const { parseEnvFile, applyFileEnv, normalizeDatabaseUrl } = require(
  "./lib/parse-env-file.cjs",
);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envLocalPath = path.join(root, ".env.local");
const devVarsPath = path.join(root, ".dev.vars");

const RUNTIME_KEYS = [
  "DATABASE_URL",
  "SESSION_SECRET",
  "ORBIS_COOKIE_SECURE",
  "ORBIS_DEV_OPEN_TENANT",
  "ORBIS_GATE_USER",
  "ORBIS_GATE_PASSWORD",
  "ORBIS_DEMO_DETECTED",
  "ORBIS_HEURISTIC_SENTIMENT",
  "ORBIS_ERROR_WEBHOOK_URL",
  "REPORTS_STORAGE",
  "REPORTS_LOCAL_DIR",
  "REPORTS_S3_ENDPOINT",
  "REPORTS_S3_BUCKET",
  "REPORTS_S3_ACCESS_KEY_ID",
  "REPORTS_S3_SECRET_ACCESS_KEY",
  "REPORTS_S3_REGION",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "OPENAI_MODEL",
  "SEO_AGENT_BASE_URL",
];

function writeDevVars(values) {
  const lines = [];
  for (const key of [...new Set([...RUNTIME_KEYS, ...Object.keys(values)])]) {
    const value = values[key];
    if (value == null || value === "") continue;
    lines.push(`${key}=${value}`);
  }
  fs.writeFileSync(devVarsPath, `${lines.join("\n")}\n`);
}

function fail(message) {
  console.error(`\n[orbis] ${message}\n`);
  process.exit(1);
}

const fileEnv = parseEnvFile(envLocalPath);
applyFileEnv(fileEnv);

const rawUrl = (process.env.DATABASE_URL ?? "").trim();
if (!rawUrl) {
  fail(
    "缺少 DATABASE_URL。每台机器单独配置，不要用仓库里的示例账号：\n" +
      "  cp .env.example .env.local\n" +
      "  把 DATABASE_URL 改成这台 MySQL 的用户/密码（宝塔「数据库」面板为准）\n" +
      "  主机必须写 127.0.0.1，不要写 localhost",
  );
}

process.env.DATABASE_URL = normalizeDatabaseUrl(rawUrl);

const runtimeEnv = { ...fileEnv };
for (const key of RUNTIME_KEYS) {
  if (process.env[key]) runtimeEnv[key] = process.env[key];
}
runtimeEnv.DATABASE_URL = process.env.DATABASE_URL;
writeDevVars(runtimeEnv);

const parsed = new URL(process.env.DATABASE_URL);
const user = decodeURIComponent(parsed.username);
const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
const host = parsed.hostname;

try {
  const connection = await mysql.createConnection({
    host,
    port: Number(parsed.port || 3306),
    user,
    password: decodeURIComponent(parsed.password),
    database,
  });
  const [rows] = await connection.query("SELECT USER() AS user, DATABASE() AS db");
  const row = Array.isArray(rows) ? rows[0] : null;
  await connection.end();
  console.log(
    `[orbis] db ok user=${row?.user ?? user} database=${row?.db ?? database} host=${host}`,
  );
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  fail(
    `DATABASE_URL 连不上 MySQL（${user}@${host}/${database}）：${detail}\n` +
      "  用户/密码以宝塔「数据库」面板为准，不要用 .env.example 里的 orbis:orbis\n" +
      "  先本机验证：mysql -u用户 -p -h127.0.0.1 -e \"SELECT USER();\"",
  );
}
