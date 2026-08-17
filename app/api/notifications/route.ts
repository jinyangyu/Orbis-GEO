import { withDb } from "@/db";
import { UserIdRequiredError, requireUserId } from "@/lib/auth/http";
import { listNotifications } from "@/lib/notifications/service";

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

export async function GET(request: Request) {
  try {
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
  } catch (error) {
    return errorResponse(error);
  }
}
