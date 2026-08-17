import { withDb } from "@/db";
import { UserIdRequiredError, requireUserId } from "@/lib/auth/http";
import { writeRateLimited } from "@/lib/http/rate-limit";
import { deleteExport } from "@/lib/reports/service";

function errorResponse(error: unknown) {
  if (error instanceof UserIdRequiredError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status =
    message.includes("not found") || message.includes("access denied")
      ? 404
      : message.includes("DATABASE_URL")
        ? 503
        : 500;
  return Response.json({ error: message }, { status });
}

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, ctx: Ctx) {
  try {
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
  } catch (error) {
    return errorResponse(error);
  }
}
