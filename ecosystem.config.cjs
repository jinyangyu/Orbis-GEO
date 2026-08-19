const path = require("path");
const { parseEnvFile } = require("./scripts/lib/parse-env-file.cjs");

const root = __dirname;

const fileEnv = parseEnvFile(path.join(root, ".env.local"));
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
