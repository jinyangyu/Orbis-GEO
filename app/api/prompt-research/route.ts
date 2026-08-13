import { withDb } from "@/db";
import { UserIdRequiredError, requireUserId } from "@/lib/identity";
import { getWorkspaceForUser } from "@/lib/onboarding/service";
import {
  getLatestPromptResearchJob,
  runPromptResearch,
} from "@/lib/prompt-research/service";
import {
  PromptResearchValidationError,
  parsePromptResearchBody,
} from "@/lib/prompt-research/validate";

function errorResponse(error: unknown) {
  if (error instanceof UserIdRequiredError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof PromptResearchValidationError) {
    return Response.json({ error: error.message }, { status: 400 });
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

export async function POST(request: Request) {
  try {
    const userId = requireUserId(request);
    const body = await request.json();
    const input = parsePromptResearchBody(body);

    const job = await withDb(async (db) => {
      let workspaceId = input.workspaceId;
      if (!workspaceId) {
        const ws = await getWorkspaceForUser(db, userId);
        workspaceId = ws?.workspace.id;
      }
      if (!workspaceId) {
        throw new Error("Workspace not found");
      }
      return runPromptResearch(db, userId, { ...input, workspaceId }, workspaceId);
    });

    return Response.json(job);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    const userId = requireUserId(request);
    const url = new URL(request.url);
    const workspaceIdParam = url.searchParams.get("workspaceId");

    const job = await withDb(async (db) => {
      let workspaceId = workspaceIdParam ?? undefined;
      if (!workspaceId) {
        const ws = await getWorkspaceForUser(db, userId);
        workspaceId = ws?.workspace.id;
      }
      if (!workspaceId) return null;
      return getLatestPromptResearchJob(db, userId, workspaceId);
    });

    if (!job) return new Response(null, { status: 204 });
    return Response.json(job);
  } catch (error) {
    return errorResponse(error);
  }
}
