import { withDb } from "@/db";
import {
  claimMonitoringWorkspaces,
  DevClaimForbiddenError,
} from "@/lib/auth/membership";
import { UserIdRequiredError, requireUserId } from "@/lib/auth/http";
import { writeRateLimited } from "@/lib/http/rate-limit";

function errorResponse(error: unknown) {
  if (error instanceof UserIdRequiredError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof DevClaimForbiddenError) {
    return Response.json({ error: error.message }, { status: 403 });
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status =
    message.includes("not found") || message.includes("access denied")
      ? 404
      : message.includes("DATABASE_URL")
        ? 503
        : 500;
  return Response.json({ error: message }, { status });
}

/** DEV: claim monitoring workspaces for current session user. */
export async function POST(request: Request) {
  try {
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
  } catch (error) {
    return errorResponse(error);
  }
}
