import { withDb } from "@/db";
import { requireUserId } from "@/lib/auth/http";
import { withApi } from "@/lib/http/api-error";
import { writeRateLimited } from "@/lib/http/rate-limit";
import {
  createExport,
  listExports,
  type ReportFiltersPayload,
} from "@/lib/reports/service";


export const GET = withApi(async (request: Request) => {
    const userId = requireUserId(request);
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return Response.json({ error: "workspaceId required" }, { status: 400 });
    }
    const items = await withDb((db) => listExports(db, userId, workspaceId));
    return Response.json({ items });
});

export const POST = withApi(async (request: Request) => {
    const limited = writeRateLimited(request);
    if (limited) return limited;
    const userId = requireUserId(request);
    const body = (await request.json().catch(() => ({}))) as {
      workspaceId?: string;
      title?: string;
      kind?: string;
      filters?: ReportFiltersPayload;
      filePath?: string | null;
      generatedAt?: string;
    };
    if (!body.workspaceId) {
      return Response.json({ error: "workspaceId required" }, { status: 400 });
    }
    const item = await withDb((db) =>
      createExport(db, userId, {
        workspaceId: body.workspaceId!,
        title: body.title || "品牌报告",
        kind: body.kind,
        filters: body.filters ?? {},
        filePath: body.filePath,
        generatedAt: body.generatedAt,
      }),
    );
    return Response.json(item);
});
