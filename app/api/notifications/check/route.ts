import { withDb } from "@/db";
import { UserIdRequiredError, requireUserId } from "@/lib/auth/http";
import type { OverviewAction } from "@/lib/metrics/types";
import {
  markNotificationCheck,
  shouldSkipNotificationCheck,
} from "@/lib/notifications/cooldown";
import { checkRecommendationsNotifications } from "@/lib/notifications/service";
import {
  allowRateLimit,
  tooManyRequests,
} from "@/lib/http/rate-limit";

function errorResponse(error: unknown) {
  if (error instanceof UserIdRequiredError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status =
    message.includes("not found")
      ? 404
      : message.includes("DATABASE_URL")
        ? 503
        : 500;
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const userId = requireUserId(request);
    const body = (await request.json().catch(() => ({}))) as {
      workspaceId?: string;
      actions?: OverviewAction[];
    };
    if (!body.workspaceId) {
      return Response.json({ error: "workspaceId required" }, { status: 400 });
    }
    if (
      !allowRateLimit(`notify-check:${userId}:${body.workspaceId}`, {
        windowMs: 5 * 60_000,
        max: 20,
      })
    ) {
      return tooManyRequests(300);
    }
    if (shouldSkipNotificationCheck(body.workspaceId)) {
      return Response.json({ created: false, skipped: true });
    }
    const actions = Array.isArray(body.actions) ? body.actions : [];
    const result = await withDb((db) =>
      checkRecommendationsNotifications(
        db,
        userId,
        body.workspaceId!,
        actions,
      ),
    );
    markNotificationCheck(body.workspaceId);
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
