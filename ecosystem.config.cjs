const fs = require("fs");
const path = require("path");

const root = __dirname;

function loadEnvFile(filePath) {
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

const fileEnv = loadEnvFile(path.join(root, ".env.local"));
if (!fileEnv.DATABASE_URL && !process.env.DATABASE_URL) {
  console.error(
    "[orbis] Missing .env.local with DATABASE_URL.\n" +
      "Copy .env.example to .env.local and set this machine's MySQL user/password.\n" +
      "Do not reuse another server's account, and do not commit .env.local.",
  );
  process.exit(1);
}

module.exports = {
  apps: [
    {
      name: "orbis",
      cwd: root,
      script: "npm",
      args: "start",
      env: {
        // 演示机：不设 NODE_ENV=production，便于 claim 监测数据
        ...fileEnv,
      },
    },
  ],
};
