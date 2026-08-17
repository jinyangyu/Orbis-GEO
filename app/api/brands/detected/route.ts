import { withDb } from "@/db";
import { UserIdRequiredError, requireUserId } from "@/lib/auth/http";
import {
  ensureDemoDetectedBrands,
  listDetectedBrands,
} from "@/lib/brands/service";
import { getWorkspaceForUser } from "@/lib/onboarding/service";

function errorResponse(error: unknown) {
  if (error instanceof UserIdRequiredError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status =
    message.includes("access denied") || message.includes("not found")
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
    let workspaceId = url.searchParams.get("workspaceId");
    const page = Number(url.searchParams.get("page") || 1);
    const pageSize = Number(url.searchParams.get("pageSize") || 8);

    const data = await withDb(async (db) => {
      if (!workspaceId) {
        const ws = await getWorkspaceForUser(db, userId);
        workspaceId = ws?.workspace.id ?? null;
      }
      if (!workspaceId) throw new Error("Workspace not found");
      await ensureDemoDetectedBrands(db, workspaceId);
      return listDetectedBrands(db, userId, workspaceId, page, pageSize);
    });

    return Response.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
