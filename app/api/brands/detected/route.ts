import { withDb } from "@/db";
import { requireUserId } from "@/lib/auth/http";
import { withApi } from "@/lib/http/api-error";
import {
  ensureDemoDetectedBrands,
  listDetectedBrands,
} from "@/lib/brands/service";
import { getWorkspaceForUser } from "@/lib/onboarding/service";


export const GET = withApi(async (request: Request) => {
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
});
