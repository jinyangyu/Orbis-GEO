import assert from "node:assert/strict";
import test from "node:test";
import {
  credentialsMatch,
  signGateToken,
  verifyGateToken,
} from "../lib/auth/gate-token.ts";

const SECRET = "unit-test-gate-secret-32characters!";

test("gate token signs and verifies", () => {
  const now = 1_700_000_000_000;
  const token = signGateToken({
    secret: SECRET,
    nowMs: now,
    expMs: now + 60_000,
  });
  assert.equal(verifyGateToken(token, { secret: SECRET, nowMs: now }), true);
});

test("gate token rejects expiry and tamper", () => {
  const now = 1_700_000_000_000;
  const token = signGateToken({
    secret: SECRET,
    nowMs: now,
    expMs: now - 1,
  });
  assert.equal(verifyGateToken(token, { secret: SECRET, nowMs: now }), false);
  const ok = signGateToken({ secret: SECRET, nowMs: now, expMs: now + 1000 });
  assert.equal(
    verifyGateToken(ok.slice(0, -3) + "xxx", { secret: SECRET, nowMs: now }),
    false,
  );
});

test("gate credentials match with timing-safe compare", () => {
  assert.equal(
    credentialsMatch("demo", "secret", "demo", "secret", SECRET),
    true,
  );
  assert.equal(
    credentialsMatch("demo", "wrong", "demo", "secret", SECRET),
    false,
  );
  assert.equal(credentialsMatch("demo", "secret", "", "secret", SECRET), false);
});
