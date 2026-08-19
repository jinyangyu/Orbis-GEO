/**
 * Server-only auth helpers for API routes.
 * Do not import this module from client components.
 */
import { assertGate, GateRequiredError } from "@/lib/auth/gate";
import { readSession, requireSession, SessionRequiredError } from "@/lib/auth/session";
import { UserIdRequiredError } from "@/lib/identity";

export { UserIdRequiredError, GateRequiredError, SessionRequiredError };

export function resolveUserId(request: Request): string | null {
  return readSession(request)?.userId ?? null;
}

/** Gate first, then session cookie. Callers must not treat these as one error. */
export function requireUserId(request: Request): string {
  assertGate(request);
  return requireSession(request);
}
