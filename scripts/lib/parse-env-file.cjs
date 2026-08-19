const fs = require("fs");

/** Shared .env.local parser for PM2, start.sh, and prepare-runtime-env. */
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const raw of fs.readFileSync(filePath, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i <= 0) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function applyFileEnv(fileEnv, target = process.env) {
  for (const [key, value] of Object.entries(fileEnv)) {
    if (target[key] == null || target[key] === "") {
      target[key] = value;
    }
  }
}

function normalizeDatabaseUrl(url) {
  const parsed = new URL(url.trim());
  if (parsed.hostname === "localhost" || parsed.hostname === "::1") {
    parsed.hostname = "127.0.0.1";
  }
  return parsed.toString().replace(/\/$/, "");
}

module.exports = { parseEnvFile, applyFileEnv, normalizeDatabaseUrl };
