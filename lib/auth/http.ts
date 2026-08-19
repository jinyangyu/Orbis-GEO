/**
 * Server-only auth helpers for API routes.
 * Do not import this module from client components.
 */
import { assertGate, GateRequiredError } from "@/lib/auth/gate";
import {
  readSession,
  requireSession,
  SessionRequiredError,
} from "@/lib/auth/session";
import { UserIdRequiredError } from "@/lib/identity";

export { UserIdRequiredError, GateRequiredError };

export function resolveUserId(request: Request): string | null {
  return readSession(request)?.userId ?? null;
}

export function requireUserId(request: Request): string {
  try {
    assertGate(request);
  } catch (e) {
    if (e instanceof GateRequiredError) {
      // Existing API routes already map UserIdRequiredError → 401.
      throw new UserIdRequiredError();
    }
    throw e;
  }
  try {
    return requireSession(request);
  } catch (e) {
    if (e instanceof SessionRequiredError) {
      throw new UserIdRequiredError();
    }
    throw e;
  }
}
