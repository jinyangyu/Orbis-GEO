import { withDb } from "@/db";
import { UserIdRequiredError, requireUserId } from "@/lib/auth/http";
import { writeRateLimited } from "@/lib/http/rate-limit";
import {
  createExport,
  listExports,
  type ReportFiltersPayload,
} from "@/lib/reports/service";

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

export async function GET(request: Request) {
  try {
    const userId = requireUserId(request);
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return Response.json({ error: "workspaceId required" }, { status: 400 });
    }
    const items = await withDb((db) => listExports(db, userId, workspaceId));
    return Response.json({ items });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
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
  } catch (error) {
    return errorResponse(error);
  }
}
