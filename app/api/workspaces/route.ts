import { withDb } from "@/db";
import { UserIdRequiredError, requireUserId } from "@/lib/identity";
import { listMonitoringWorkspaces } from "@/lib/metrics/service";

function errorResponse(error: unknown) {
  if (error instanceof UserIdRequiredError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status = message.includes("DATABASE_URL") ? 503 : 500;
  return Response.json({ error: message }, { status });
}

/** List workspaces that have monitoring observations (for dashboard switcher). */
export async function GET(request: Request) {
  try {
    requireUserId(request);
    const items = await withDb((db) => listMonitoringWorkspaces(db));
    return Response.json({ items });
  } catch (error) {
    return errorResponse(error);
  }
}
