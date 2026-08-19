import { withDb } from "@/db";
import { requireUserId } from "@/lib/auth/http";
import { withApi } from "@/lib/http/api-error";
import {
  getPromptDetailMetrics,
  resolveWorkspaceId,
} from "@/lib/metrics/service";


export const GET = withApi(async (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => {
    const userId = requireUserId(request);
    const { id } = await context.params;
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
    const data = await withDb((db) =>
      getPromptDetailMetrics(db, workspaceId, id, {
        from: url.searchParams.get("from") ?? undefined,
        to: url.searchParams.get("to") ?? undefined,
        days: (() => {
          const raw = url.searchParams.get("days");
          if (!raw) return undefined;
          const n = Number(raw);
          return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
        })(),
        engine: url.searchParams.get("engine") || undefined,
      }),
    );
    if (!data) {
      return Response.json({ error: "Prompt not found" }, { status: 404 });
    }
    return Response.json(data);
});
