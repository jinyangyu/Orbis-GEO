import assert from "node:assert/strict";
import test from "node:test";
import { authFailure } from "../lib/http/auth-error-code.ts";

test("authFailure distinguishes gate vs session 401s", () => {
  const gate = new Error("Login required");
  gate.name = "GateRequiredError";
  assert.deepEqual(authFailure(gate), {
    code: "GATE_REQUIRED",
    message: "Login required",
  });

  const session = new Error("Missing or invalid session cookie");
  session.name = "SessionRequiredError";
  assert.equal(authFailure(session)?.code, "SESSION_REQUIRED");
  assert.notEqual(authFailure(session)?.code, "GATE_REQUIRED");
});

test("legacy UserIdRequiredError maps to session, not gate", () => {
  const legacy = new Error("Missing or invalid session cookie");
  legacy.name = "UserIdRequiredError";
  assert.equal(authFailure(legacy)?.code, "SESSION_REQUIRED");
});
