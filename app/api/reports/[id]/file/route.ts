import { withDb } from "@/db";
import { UserIdRequiredError, requireUserId } from "@/lib/auth/http";
import { writeRateLimited } from "@/lib/http/rate-limit";
import { attachExportFile, getExportFile } from "@/lib/reports/service";

function errorResponse(error: unknown) {
  if (error instanceof UserIdRequiredError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status =
    message.includes("not found") || message.includes("access denied")
      ? 404
      : message.includes("超过") || message.includes("空文件")
        ? 400
        : message.includes("DATABASE_URL") || message.includes("S3")
          ? 503
          : 500;
  return Response.json({ error: message }, { status });
}

type Ctx = { params: Promise<{ id: string }> };

/** Upload PDF bytes for an existing report_exports row. */
export async function PUT(request: Request, ctx: Ctx) {
  try {
    const limited = writeRateLimited(request);
    if (limited) return limited;
    const userId = requireUserId(request);
    const { id } = await ctx.params;
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId")?.trim();
    if (!workspaceId || !id) {
      return Response.json(
        { error: "workspaceId and id required" },
        { status: 400 },
      );
    }
    const buf = new Uint8Array(await request.arrayBuffer());
    const item = await withDb((db) =>
      attachExportFile(db, userId, workspaceId, id, buf),
    );
    return Response.json(item);
  } catch (error) {
    return errorResponse(error);
  }
}

/** Download stored PDF. */
export async function GET(request: Request, ctx: Ctx) {
  try {
    const userId = requireUserId(request);
    const { id } = await ctx.params;
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId")?.trim();
    if (!workspaceId || !id) {
      return Response.json(
        { error: "workspaceId and id required" },
        { status: 400 },
      );
    }
    const file = await withDb((db) =>
      getExportFile(db, userId, workspaceId, id),
    );
    if (!file) {
      return Response.json({ error: "文件不存在或尚未上传" }, { status: 404 });
    }
    const safeName = `${(file.title || "报告").replace(/[^\w\u4e00-\u9fff.-]+/g, "_")}.pdf`;
    return new Response(Buffer.from(file.bytes), {
      status: 200,
      headers: {
        "content-type": file.contentType,
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
