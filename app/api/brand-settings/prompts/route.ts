import { withDb } from "@/db";
import {
  bulkSetPromptMembership,
  listSettingsPrompts,
} from "@/lib/brand-settings/service";
import { assertWorkspaceMember } from "@/lib/auth/membership";
import { requireUserId } from "@/lib/auth/http";
import { withApi } from "@/lib/http/api-error";
import { getWorkspaceForUser } from "@/lib/onboarding/service";


async function resolveWorkspaceId(
  userId: string,
  workspaceIdParam?: string | null,
): Promise<string> {
  if (workspaceIdParam?.trim()) {
    const id = workspaceIdParam.trim();
    await withDb((db) => assertWorkspaceMember(db, userId, id));
    return id;
  }
  const ws = await withDb((db) => getWorkspaceForUser(db, userId));
  if (!ws?.workspace.id) throw new Error("Workspace not found");
  return ws.workspace.id;
}

export const GET = withApi(async (request: Request) => {
    const userId = requireUserId(request);
    const url = new URL(request.url);
    const workspaceId = await resolveWorkspaceId(
      userId,
      url.searchParams.get("workspaceId"),
    );
    const paneRaw = url.searchParams.get("pane");
    const pane = paneRaw === "inactive" ? "inactive" : "active";
    const page = Number(url.searchParams.get("page") || "1");
    const pageSize = Number(url.searchParams.get("pageSize") || "50");

    const data = await withDb((db) =>
      listSettingsPrompts(db, userId, workspaceId, {
        q: url.searchParams.get("q") || undefined,
        market: url.searchParams.get("market") || undefined,
        tag: url.searchParams.get("tag") || undefined,
        pane,
        page: Number.isFinite(page) ? page : 1,
        pageSize: Number.isFinite(pageSize) ? pageSize : 50,
      }),
    );
    return Response.json(data);
});

export const PATCH = withApi(async (request: Request) => {
    const userId = requireUserId(request);
    const body = (await request.json()) as {
      workspaceId?: string;
      activateIds?: string[];
      deactivateIds?: string[];
    };
    const workspaceId = await resolveWorkspaceId(userId, body.workspaceId);
    const result = await withDb((db) =>
      bulkSetPromptMembership(
        db,
        userId,
        workspaceId,
        Array.isArray(body.activateIds) ? body.activateIds : [],
        Array.isArray(body.deactivateIds) ? body.deactivateIds : [],
      ),
    );
    return Response.json(result);
});
