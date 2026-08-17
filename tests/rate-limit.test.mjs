import assert from "node:assert/strict";
import test from "node:test";
import {
  allowRateLimit,
  resetRateLimitBuckets,
} from "../lib/http/rate-limit.ts";

test("window overflow returns false", () => {
  resetRateLimitBuckets();
  const opts = { windowMs: 1000, max: 2 };
  assert.equal(allowRateLimit("k", opts, 0), true);
  assert.equal(allowRateLimit("k", opts, 1), true);
  assert.equal(allowRateLimit("k", opts, 2), false);
});

test("window expiry allows new tokens", () => {
  resetRateLimitBuckets();
  const opts = { windowMs: 1000, max: 1 };
  assert.equal(allowRateLimit("exp", opts, 0), true);
  assert.equal(allowRateLimit("exp", opts, 999), false);
  assert.equal(allowRateLimit("exp", opts, 1000), true);
});

test("keys are isolated", () => {
  resetRateLimitBuckets();
  const opts = { windowMs: 1000, max: 1 };
  assert.equal(allowRateLimit("a", opts, 0), true);
  assert.equal(allowRateLimit("b", opts, 0), true);
  assert.equal(allowRateLimit("a", opts, 1), false);
});
