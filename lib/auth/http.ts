/**
 * Server-only auth helpers for API routes.
 * Do not import this module from client components.
 */
import {
  readSession,
  requireSession,
  SessionRequiredError,
} from "@/lib/auth/session";
import { UserIdRequiredError } from "@/lib/identity";

export { UserIdRequiredError };

export function resolveUserId(request: Request): string | null {
  return readSession(request)?.userId ?? null;
}

export function requireUserId(request: Request): string {
  try {
    return requireSession(request);
  } catch (e) {
    if (e instanceof SessionRequiredError) {
      throw new UserIdRequiredError();
    }
    throw e;
  }
}
