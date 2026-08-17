import { withDb } from "@/db";
import { UserIdRequiredError, requireUserId } from "@/lib/auth/http";
import { writeRateLimited } from "@/lib/http/rate-limit";
import {
  listStarredUrls,
  starUrl,
  unstarUrl,
} from "@/lib/citations/stars";

function errorResponse(error: unknown) {
  if (error instanceof UserIdRequiredError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status =
    message.includes("not found")
      ? 404
      : message.includes("DATABASE_URL")
        ? 503
        : message.includes("无效")
          ? 400
          : 500;
  return Response.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
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
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
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
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
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
  } catch (error) {
    return errorResponse(error);
  }
}
