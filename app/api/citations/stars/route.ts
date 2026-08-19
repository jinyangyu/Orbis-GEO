import { withDb } from "@/db";
import { requireUserId } from "@/lib/auth/http";
import { withApi } from "@/lib/http/api-error";
import { writeRateLimited } from "@/lib/http/rate-limit";
import {
  listStarredUrls,
  starUrl,
  unstarUrl,
} from "@/lib/citations/stars";


export const GET = withApi(async (request: Request) => {
    const userId = requireUserId(request);
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return Response.json({ error: "workspaceId required" }, { status: 400 });
    }
    const urls = await withDb((db) =>
      listStarredUrls(db, userId, workspaceId),
    );
    return Response.json({ urls });
});

export const POST = withApi(async (request: Request) => {
    const limited = writeRateLimited(request);
    if (limited) return limited;
    const userId = requireUserId(request);
    const body = (await request.json().catch(() => ({}))) as {
      workspaceId?: string;
      url?: string;
    };
    if (!body.workspaceId || !body.url) {
      return Response.json(
        { error: "workspaceId and url required" },
        { status: 400 },
      );
    }
    const result = await withDb((db) =>
      starUrl(db, userId, body.workspaceId!, body.url!),
    );
    return Response.json(result);
});

export const DELETE = withApi(async (request: Request) => {
    const limited = writeRateLimited(request);
    if (limited) return limited;
    const userId = requireUserId(request);
    const urlObj = new URL(request.url);
    let workspaceId = urlObj.searchParams.get("workspaceId");
    let citeUrl = urlObj.searchParams.get("url");
    if (!workspaceId || !citeUrl) {
      const body = (await request.json().catch(() => ({}))) as {
        workspaceId?: string;
        url?: string;
      };
      workspaceId = workspaceId || body.workspaceId || null;
      citeUrl = citeUrl || body.url || null;
    }
    if (!workspaceId || !citeUrl) {
      return Response.json(
        { error: "workspaceId and url required" },
        { status: 400 },
      );
    }
    const result = await withDb((db) =>
      unstarUrl(db, userId, workspaceId!, citeUrl!),
    );
    return Response.json(result);
});
