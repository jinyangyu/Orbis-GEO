import { withDb } from "@/db";
import {
  getBrandSettings,
  patchBrandSettings,
} from "@/lib/brand-settings/service";
import { assertWorkspaceMember } from "@/lib/auth/membership";
import { requireUserId } from "@/lib/auth/http";
import { withApi } from "@/lib/http/api-error";
import { writeRateLimited } from "@/lib/http/rate-limit";
import { getWorkspaceForUser } from "@/lib/onboarding/service";


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

export const GET = withApi(async (request: Request) => {
    const userId = requireUserId(request);
    const workspaceId = await resolveWorkspaceId(request, userId);
    const data = await withDb((db) =>
      getBrandSettings(db, userId, workspaceId),
    );
    return Response.json(data);
});

export const PATCH = withApi(async (request: Request) => {
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
});
