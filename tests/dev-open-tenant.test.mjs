import assert from "node:assert/strict";
import test from "node:test";
import { isDevOpenTenant } from "../lib/auth/dev-open-tenant.ts";

test("production ignores ORBIS_DEV_OPEN_TENANT", () => {
  assert.equal(
    isDevOpenTenant({ NODE_ENV: "production", ORBIS_DEV_OPEN_TENANT: "1" }),
    false,
  );
});

test("non-production honors ORBIS_DEV_OPEN_TENANT", () => {
  assert.equal(
    isDevOpenTenant({ NODE_ENV: "development", ORBIS_DEV_OPEN_TENANT: "1" }),
    true,
  );
  assert.equal(
    isDevOpenTenant({ NODE_ENV: "development", ORBIS_DEV_OPEN_TENANT: "0" }),
    false,
  );
});
