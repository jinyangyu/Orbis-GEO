import { withDb } from "@/db";
import { UserIdRequiredError, requireUserId } from "@/lib/auth/http";
import { markNotificationsRead } from "@/lib/notifications/service";

function errorResponse(error: unknown) {
  if (error instanceof UserIdRequiredError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status = message.includes("DATABASE_URL") ? 503 : 500;
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
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
  } catch (error) {
    return errorResponse(error);
  }
}
