import { withDb } from "@/db";
import { requireUserId } from "@/lib/auth/http";
import { withApi } from "@/lib/http/api-error";
import { markNotificationsRead } from "@/lib/notifications/service";


export const POST = withApi(async (request: Request) => {
    const userId = requireUserId(request);
    const body = (await request.json().catch(() => ({}))) as {
      eventIds?: string[];
    };
    const eventIds = Array.isArray(body.eventIds) ? body.eventIds : [];
    if (!eventIds.length) {
      return Response.json({ error: "eventIds required" }, { status: 400 });
    }
    await withDb((db) => markNotificationsRead(db, userId, eventIds));
    return Response.json({ ok: true });
});
