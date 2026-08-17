import { withDb } from "@/db";
import {
  getBrandSettings,
  patchBrandSettings,
} from "@/lib/brand-settings/service";
import { assertWorkspaceMember } from "@/lib/auth/membership";
import { UserIdRequiredError, requireUserId } from "@/lib/auth/http";
import { writeRateLimited } from "@/lib/http/rate-limit";
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
        : message.includes("URL") ||
            message.includes("不允许") ||
            message.includes("仅支持") ||
            message.includes("仅允许")
          ? 400
          : 500;
  return Response.json({ error: message }, { status });
}

async function resolveWorkspaceId(
  request: Request,
  userId: string,
  bodyWorkspaceId?: string,
) {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("workspaceId")?.trim();
  const workspaceId = bodyWorkspaceId?.trim() || fromQuery;
  if (workspaceId) {
    await withDb((db) => assertWorkspaceMember(db, userId, workspaceId));
    return workspaceId;
  }
  const ws = await withDb((db) => getWorkspaceForUser(db, userId));
  if (!ws?.workspace.id) throw new Error("Workspace not found");
  return ws.workspace.id;
}

export async function GET(request: Request) {
  try {
    const userId = requireUserId(request);
    const workspaceId = await resolveWorkspaceId(request, userId);
    const data = await withDb((db) =>
      getBrandSettings(db, userId, workspaceId),
    );
    return Response.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const limited = writeRateLimited(request);
    if (limited) return limited;
    const userId = requireUserId(request);
    const body = (await request.json()) as {
      workspaceId?: string;
      reportTitle?: string;
      brandName?: string;
      brandDomain?: string;
      aliases?: string[];
      domainAliases?: string[];
      includeSubdomains?: boolean;
      notifyNewRecommendations?: boolean;
      notifyWebhookUrl?: string;
    };
    const workspaceId = await resolveWorkspaceId(
      request,
      userId,
      body.workspaceId,
    );
    const data = await withDb((db) =>
      patchBrandSettings(db, userId, workspaceId, body),
    );
    return Response.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
