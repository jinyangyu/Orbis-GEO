import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parseEnvFile, applyFileEnv, normalizeDatabaseUrl } = require(
  "../scripts/lib/parse-env-file.cjs",
);

test("parseEnvFile skips comments and strips quotes", () => {
  const file = path.join(os.tmpdir(), `orbis-env-${Date.now()}.env`);
  fs.writeFileSync(
    file,
    [
      "# comment",
      "DATABASE_URL=mysql://u:p@localhost:3306/orbis",
      "SESSION_SECRET=\"abc def\"",
      "",
    ].join("\n"),
  );
  const env = parseEnvFile(file);
  fs.unlinkSync(file);
  assert.equal(env.DATABASE_URL, "mysql://u:p@localhost:3306/orbis");
  assert.equal(env.SESSION_SECRET, "abc def");
});

test("applyFileEnv does not overwrite non-empty process env", () => {
  const target = { FOO: "keep", BAR: "" };
  applyFileEnv({ FOO: "new", BAR: "from-file", BAZ: "added" }, target);
  assert.equal(target.FOO, "keep");
  assert.equal(target.BAR, "from-file");
  assert.equal(target.BAZ, "added");
});

test("normalizeDatabaseUrl forces TCP host", () => {
  assert.equal(
    normalizeDatabaseUrl("mysql://u:p@localhost:3306/orbis"),
    "mysql://u:p@127.0.0.1:3306/orbis",
  );
});
