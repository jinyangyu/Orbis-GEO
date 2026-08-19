import { withDb } from "@/db";
import { requireUserId } from "@/lib/auth/http";
import { withApi } from "@/lib/http/api-error";
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


export const POST = withApi(async (request: Request) => {
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
});
