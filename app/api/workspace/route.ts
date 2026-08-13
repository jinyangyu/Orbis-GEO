import { withDb } from "@/db";
import { UserIdRequiredError, requireUserId } from "@/lib/identity";
import { resolveWorkspaceId } from "@/lib/metrics/service";
import {
  getWorkspaceById,
  getWorkspaceForUser,
} from "@/lib/onboarding/service";

function errorResponse(error: unknown) {
  if (error instanceof UserIdRequiredError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  const cause =
    error instanceof Error && error.cause instanceof Error
      ? error.cause.message
      : "";
  const combined = cause ? `${message} (${cause})` : message;
  const status = message.includes("DATABASE_URL") ? 503 : 500;
  return Response.json({ error: combined }, { status });
}

export async function GET(request: Request) {
  try {
    const userId = requireUserId(request);
    const url = new URL(request.url);
    const workspaceIdParam = url.searchParams.get("workspaceId");
    const slug = url.searchParams.get("slug");

    const workspace = await withDb(async (db) => {
      if (workspaceIdParam) return getWorkspaceById(db, workspaceIdParam);
      if (slug) {
        const id = await resolveWorkspaceId(db, { slug });
        return id ? getWorkspaceById(db, id) : null;
      }
      return getWorkspaceForUser(db, userId);
    });

    if (!workspace) {
      return new Response(null, { status: 204 });
    }
    return Response.json(workspace);
  } catch (error) {
    return errorResponse(error);
  }
}
