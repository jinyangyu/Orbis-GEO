import { withDb } from "@/db";
import { requireUserId } from "@/lib/auth/http";
import { withApi } from "@/lib/http/api-error";
import { listMonitoringWorkspaces } from "@/lib/metrics/service";


/** List member workspaces that have monitoring observations. */
export const GET = withApi(async (request: Request) => {
    const userId = requireUserId(request);
    const items = await withDb((db) => listMonitoringWorkspaces(db, userId));
    return Response.json({ items });
});
