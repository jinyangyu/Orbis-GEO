import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeMysqlHost,
  parseDatabaseUrl,
  requireDatabaseUrl,
} from "../lib/database-url.ts";

test("normalizeMysqlHost uses TCP instead of unix socket", () => {
  assert.equal(normalizeMysqlHost("localhost"), "127.0.0.1");
  assert.equal(normalizeMysqlHost("::1"), "127.0.0.1");
  assert.equal(normalizeMysqlHost("127.0.0.1"), "127.0.0.1");
});

test("parseDatabaseUrl reads user and forces 127.0.0.1", () => {
  const options = parseDatabaseUrl(
    "mysql://yjy2026:yjy2026__@localhost:3306/orbis",
  );
  assert.equal(options.host, "127.0.0.1");
  assert.equal(options.user, "yjy2026");
  assert.equal(options.password, "yjy2026__");
  assert.equal(options.database, "orbis");
  assert.equal(options.port, 3306);
});

test("requireDatabaseUrl fails closed when unset", () => {
  assert.throws(() => requireDatabaseUrl({}), /DATABASE_URL is not configured/);
  assert.equal(
    requireDatabaseUrl({ DATABASE_URL: " mysql://u:p@127.0.0.1:3306/orbis " }),
    "mysql://u:p@127.0.0.1:3306/orbis",
  );
});
