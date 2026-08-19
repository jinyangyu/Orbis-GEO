import { withDb } from "@/db";
import { requireUserId } from "@/lib/auth/http";
import { withApi } from "@/lib/http/api-error";
import {
  createCompetitor,
  listActiveBrands,
} from "@/lib/brands/service";
import { getWorkspaceForUser } from "@/lib/onboarding/service";


async function resolveWorkspaceId(
  userId: string,
  workspaceIdParam?: string | null,
): Promise<string> {
  return withDb(async (db) => {
    const { assertWorkspaceMember } = await import("@/lib/auth/membership");
    if (workspaceIdParam) {
      await assertWorkspaceMember(db, userId, workspaceIdParam);
      return workspaceIdParam;
    }
    const ws = await getWorkspaceForUser(db, userId);
    if (!ws?.workspace.id) throw new Error("Workspace not found");
    return ws.workspace.id;
  });
}

export const GET = withApi(async (request: Request) => {
    const userId = requireUserId(request);
    const url = new URL(request.url);
    const workspaceId = await resolveWorkspaceId(
      userId,
      url.searchParams.get("workspaceId"),
    );
    const data = await withDb((db) => listActiveBrands(db, userId, workspaceId));
    return Response.json({ workspaceId, ...data });
});

export const POST = withApi(async (request: Request) => {
    const userId = requireUserId(request);
    const body = (await request.json()) as {
      workspaceId?: string;
      name?: string;
      domain?: string;
      mark?: string;
      color?: string;
    };
    const workspaceId = await resolveWorkspaceId(userId, body.workspaceId);
    const brand = await withDb((db) =>
      createCompetitor(db, userId, workspaceId, {
        name: body.name ?? "",
        domain: body.domain,
        mark: body.mark,
        color: body.color,
      }),
    );
    return Response.json(brand);
});
