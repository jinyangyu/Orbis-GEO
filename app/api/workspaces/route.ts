import { withDb } from "@/db";
import { UserIdRequiredError, requireUserId } from "@/lib/auth/http";
import { listMonitoringWorkspaces } from "@/lib/metrics/service";

function errorResponse(error: unknown) {
  if (error instanceof UserIdRequiredError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status = message.includes("DATABASE_URL") ? 503 : 500;
  return Response.json({ error: message }, { status });
}

/** List member workspaces that have monitoring observations. */
export async function GET(request: Request) {
  try {
    const userId = requireUserId(request);
    const items = await withDb((db) => listMonitoringWorkspaces(db, userId));
    return Response.json({ items });
  } catch (error) {
    return errorResponse(error);
  }
}
