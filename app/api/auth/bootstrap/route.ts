import { withDb } from "@/db";
import {
  buildSessionCookieHeader,
  isDevOpenTenant,
  proposedUserIdFromRequest,
  readSession,
  SessionRequiredError,
} from "@/lib/auth/session";
import { ensureUserRow } from "@/lib/auth/users";
import { UserIdRequiredError } from "@/lib/auth/http";
import {
  allowRateLimit,
  clientIp,
  tooManyRequests,
} from "@/lib/http/rate-limit";

function errorResponse(error: unknown) {
  if (
    error instanceof SessionRequiredError ||
    error instanceof UserIdRequiredError
  ) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status =
    message.includes("DATABASE_URL") || message.includes("SESSION_SECRET")
      ? 503
      : 500;
  return Response.json({ error: message }, { status });
}

/** Issue or refresh signed session cookie; header UUID only when no cookie yet. */
export async function POST(request: Request) {
  try {
    if (
      !allowRateLimit(`bootstrap:${clientIp(request)}`, {
        windowMs: 60_000,
        max: 30,
      })
    ) {
      return tooManyRequests(60);
    }
    const existing = readSession(request);
    const userId = existing?.userId ?? proposedUserIdFromRequest(request);
    await withDb((db) => ensureUserRow(db, userId));
    return Response.json(
      { userId, devOpenTenant: isDevOpenTenant() },
      {
        headers: {
          "set-cookie": buildSessionCookieHeader(userId),
        },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
