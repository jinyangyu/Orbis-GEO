import { withDb } from "@/db";
import { requireUserId } from "@/lib/auth/http";
import { withApi } from "@/lib/http/api-error";
import { listNotifications } from "@/lib/notifications/service";


export const GET = withApi(async (request: Request) => {
    const userId = requireUserId(request);
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId")?.trim();
    if (!workspaceId) {
      return Response.json({ error: "workspaceId required" }, { status: 400 });
    }
    const limit = Number(url.searchParams.get("limit") || 20);
    const data = await withDb((db) =>
      listNotifications(db, userId, workspaceId, limit),
    );
    return Response.json(data);
});
