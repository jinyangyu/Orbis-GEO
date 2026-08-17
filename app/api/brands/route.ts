import { withDb } from "@/db";
import { UserIdRequiredError, requireUserId } from "@/lib/auth/http";
import {
  createCompetitor,
  listActiveBrands,
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
        : message.includes("必填") || message.includes("无效") || message.includes("不能")
          ? 400
          : 500;
  return Response.json({ error: message }, { status });
}

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

export async function GET(request: Request) {
  try {
    const userId = requireUserId(request);
    const url = new URL(request.url);
    const workspaceId = await resolveWorkspaceId(
      userId,
      url.searchParams.get("workspaceId"),
    );
    const data = await withDb((db) => listActiveBrands(db, userId, workspaceId));
    return Response.json({ workspaceId, ...data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
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
  } catch (error) {
    return errorResponse(error);
  }
}
