import { withDb } from "@/db";
import { requireUserId } from "@/lib/auth/http";
import { withApi } from "@/lib/http/api-error";
import { getBrandsMetrics, resolveWorkspaceId } from "@/lib/metrics/service";


function intParam(value: string | null): number | undefined {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}

export const GET = withApi(async (request: Request) => {
    const userId = requireUserId(request);
    const url = new URL(request.url);
    const workspaceId = await withDb((db) =>
      resolveWorkspaceId(db, {
        userId,
        workspaceId: url.searchParams.get("workspaceId"),
        slug: url.searchParams.get("slug"),
      }),
    );
    if (!workspaceId) {
      return Response.json({ error: "No monitoring workspace" }, { status: 404 });
    }
    const engine = url.searchParams.get("engine") ?? undefined;
    const data = await withDb((db) =>
      getBrandsMetrics(db, workspaceId, {
        engine: engine || undefined,
        from: url.searchParams.get("from") ?? undefined,
        to: url.searchParams.get("to") ?? undefined,
        days: intParam(url.searchParams.get("days")),
      }),
    );
    if (!data) {
      return Response.json({ error: "Workspace not found" }, { status: 404 });
    }
    return Response.json(data);
});
