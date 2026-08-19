import { withDb } from "@/db";
import { requireUserId } from "@/lib/auth/http";
import { withApi } from "@/lib/http/api-error";
import { writeRateLimited } from "@/lib/http/rate-limit";
import { attachExportFile, getExportFile } from "@/lib/reports/service";


type Ctx = { params: Promise<{ id: string }> };

/** Upload PDF bytes for an existing report_exports row. */
export const PUT = withApi(async (request: Request, ctx: Ctx) => {
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
});

/** Download stored PDF. */
export const GET = withApi(async (request: Request, ctx: Ctx) => {
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
});
