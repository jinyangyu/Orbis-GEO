import { withDb } from "@/db";
import {
  buildSessionCookieHeader,
  isDevOpenTenant,
  proposedUserIdFromRequest,
  readSession,
} from "@/lib/auth/session";
import { assertGate } from "@/lib/auth/gate";
import { ensureUserRow } from "@/lib/auth/users";
import { withApi } from "@/lib/http/api-error";
import {
  allowRateLimit,
  clientIp,
  tooManyRequests,
} from "@/lib/http/rate-limit";

/** Issue or refresh signed session cookie; header UUID only when no cookie yet. */
export const POST = withApi(async (request: Request) => {
    assertGate(request);
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
});
