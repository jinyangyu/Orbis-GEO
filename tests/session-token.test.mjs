import assert from "node:assert/strict";
import test from "node:test";
import {
  signSessionToken,
  verifySessionToken,
} from "../lib/auth/session-token.ts";

const SECRET = "unit-test-session-secret-32chars!!";
const USER = "11111111-1111-4111-8111-111111111111";

test("sign and verify session token", () => {
  const now = 1_700_000_000_000;
  const token = signSessionToken(USER, {
    secret: SECRET,
    nowMs: now,
    expMs: now + 60_000,
  });
  const parsed = verifySessionToken(token, { secret: SECRET, nowMs: now });
  assert.ok(parsed);
  assert.equal(parsed.userId, USER);
});

test("rejects tampered signature", () => {
  const token = signSessionToken(USER, { secret: SECRET });
  const bad = token.slice(0, -4) + "xxxx";
  assert.equal(verifySessionToken(bad, { secret: SECRET }), null);
});

test("rejects expired token", () => {
  const now = 1_700_000_000_000;
  const token = signSessionToken(USER, {
    secret: SECRET,
    nowMs: now,
    expMs: now - 1,
  });
  assert.equal(
    verifySessionToken(token, { secret: SECRET, nowMs: now }),
    null,
  );
});

test("rejects invalid user id", () => {
  assert.throws(() => signSessionToken("not-a-uuid", { secret: SECRET }));
});
