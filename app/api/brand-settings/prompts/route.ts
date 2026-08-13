import { withDb } from "@/db";
import {
  bulkSetPromptMembership,
  listSettingsPrompts,
} from "@/lib/brand-settings/service";
import { UserIdRequiredError, requireUserId } from "@/lib/identity";
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

async function resolveWorkspaceId(
  userId: string,
  workspaceIdParam?: string | null,
): Promise<string> {
  if (workspaceIdParam?.trim()) return workspaceIdParam.trim();
  const ws = await withDb((db) => getWorkspaceForUser(db, userId));
  if (!ws?.workspace.id) throw new Error("Workspace not found");
  return ws.workspace.id;
}

export async function GET(request: Request) {
  try {
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
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
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
  } catch (error) {
    return errorResponse(error);
  }
}
