import { withDb } from "@/db";
import { UserIdRequiredError, requireUserId } from "@/lib/auth/http";
import {
  applyStarredFlag,
  listStarredUrls,
} from "@/lib/citations/stars";
import { getCitationsMetrics, resolveWorkspaceId } from "@/lib/metrics/service";

function errorResponse(error: unknown) {
  if (error instanceof UserIdRequiredError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status = message.includes("DATABASE_URL") ? 503 : 500;
  return Response.json({ error: message }, { status });
}

function intParam(value: string | null): number | undefined {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}

export async function GET(request: Request) {
  try {
    const userId = requireUserId(request);
    const url = new URL(request.url);
    const engine = url.searchParams.get("engine") ?? undefined;
    const data = await withDb(async (db) => {
      const workspaceId = await resolveWorkspaceId(db, {
        userId,
        workspaceId: url.searchParams.get("workspaceId"),
        slug: url.searchParams.get("slug"),
      });
      if (!workspaceId) return { workspaceId: null, metrics: null };
      const metrics = await getCitationsMetrics(db, workspaceId, {
        engine: engine || undefined,
        from: url.searchParams.get("from") ?? undefined,
        to: url.searchParams.get("to") ?? undefined,
        days: intParam(url.searchParams.get("days")),
      });
      if (!metrics) return { workspaceId, metrics: null };
      const starred = await listStarredUrls(db, userId, workspaceId);
      const set = new Set(starred);
      return {
        workspaceId,
        metrics: {
          ...metrics,
          urls: applyStarredFlag(metrics.urls, set),
          winners: applyStarredFlag(metrics.winners, set),
          losers: applyStarredFlag(metrics.losers, set),
        },
      };
    });
    if (!data.workspaceId) {
      return Response.json({ error: "No monitoring workspace" }, { status: 404 });
    }
    if (!data.metrics) {
      return Response.json({ error: "Workspace not found" }, { status: 404 });
    }
    return Response.json(data.metrics);
  } catch (error) {
    return errorResponse(error);
  }
}
