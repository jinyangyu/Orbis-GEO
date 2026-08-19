import { withDb } from "@/db";
import { requireUserId } from "@/lib/auth/http";
import { withApi } from "@/lib/http/api-error";
import { writeRateLimited } from "@/lib/http/rate-limit";
import { deleteExport } from "@/lib/reports/service";


type Ctx = { params: Promise<{ id: string }> };

export const DELETE = withApi(async (request: Request, ctx: Ctx) => {
    const limited = writeRateLimited(request);
    if (limited) return limited;
    const userId = requireUserId(request);
    const { id } = await ctx.params;
    const url = new URL(request.url);
    let workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      const body = (await request.json().catch(() => ({}))) as {
        workspaceId?: string;
      };
      workspaceId = body.workspaceId ?? null;
    }
    if (!workspaceId || !id) {
      return Response.json(
        { error: "workspaceId and id required" },
        { status: 400 },
      );
    }
    await withDb((db) => deleteExport(db, userId, workspaceId!, id));
    return Response.json({ ok: true });
});
