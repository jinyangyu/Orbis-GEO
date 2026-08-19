import { withDb } from "@/db";
import {
  claimMonitoringWorkspaces,
  DevClaimForbiddenError,
} from "@/lib/auth/membership";
import { requireUserId } from "@/lib/auth/http";
import { withApi } from "@/lib/http/api-error";
import { writeRateLimited } from "@/lib/http/rate-limit";


/** DEV: claim monitoring workspaces for current session user. */
export const POST = withApi(async (request: Request) => {
    const limited = writeRateLimited(request);
    if (limited) return limited;
    const userId = requireUserId(request);
    const body = (await request.json().catch(() => ({}))) as {
      workspaceId?: string;
    };
    const result = await withDb((db) =>
      claimMonitoringWorkspaces(db, userId, body.workspaceId ?? null),
    );
    return Response.json(result);
}, {
  statusFor: (error) =>
    error instanceof DevClaimForbiddenError ? 403 : undefined,
});
