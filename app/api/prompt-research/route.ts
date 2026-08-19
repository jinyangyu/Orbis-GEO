import { withDb } from "@/db";
import { requireUserId } from "@/lib/auth/http";
import { withApi } from "@/lib/http/api-error";
import { getWorkspaceForUser } from "@/lib/onboarding/service";
import {
  getLatestPromptResearchJob,
  runPromptResearch,
} from "@/lib/prompt-research/service";
import {
  PromptResearchValidationError,
  parsePromptResearchBody,
} from "@/lib/prompt-research/validate";


export const POST = withApi(async (request: Request) => {
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
}, {
  statusFor: (error) =>
    error instanceof PromptResearchValidationError ? 400 : undefined,
});

export const GET = withApi(async (request: Request) => {
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
}, {
  statusFor: (error) =>
    error instanceof PromptResearchValidationError ? 400 : undefined,
});
