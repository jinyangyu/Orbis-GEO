import { withDb } from "@/db";
import { assertWorkspaceMember } from "@/lib/auth/membership";
import { requireUserId } from "@/lib/auth/http";
import { withApi } from "@/lib/http/api-error";
import { resolveWorkspaceId } from "@/lib/metrics/service";
import {
  getWorkspaceById,
  getWorkspaceForUser,
} from "@/lib/onboarding/service";


export const GET = withApi(async (request: Request) => {
    const userId = requireUserId(request);
    const url = new URL(request.url);
    const workspaceIdParam = url.searchParams.get("workspaceId");
    const slug = url.searchParams.get("slug");

    const workspace = await withDb(async (db) => {
      if (workspaceIdParam) {
        await assertWorkspaceMember(db, userId, workspaceIdParam);
        return getWorkspaceById(db, workspaceIdParam);
      }
      if (slug) {
        const id = await resolveWorkspaceId(db, { userId, slug });
        return id ? getWorkspaceById(db, id) : null;
      }
      return getWorkspaceForUser(db, userId);
    });

    if (!workspace) {
      return new Response(null, { status: 204 });
    }
    return Response.json(workspace);
});
