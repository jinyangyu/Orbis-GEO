import assert from "node:assert/strict";
import test from "node:test";
import { isSafeOutboundUrl } from "../lib/http/safe-url.ts";

test("unsafe error webhook URLs are rejected", () => {
  assert.equal(isSafeOutboundUrl("http://127.0.0.1/hook"), false);
  assert.equal(isSafeOutboundUrl("https://example.com/hook"), true);
});
