import { withDb } from "@/db";
import { requireUserId } from "@/lib/auth/http";
import { withApi } from "@/lib/http/api-error";
import { getPromptResearchJob } from "@/lib/prompt-research/service";


export const GET = withApi(async (
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) => {
    const userId = requireUserId(request);
    const params = await Promise.resolve(context.params);
    const job = await withDb((db) => getPromptResearchJob(db, userId, params.id));
    if (!job) {
      return Response.json({ error: "Job not found" }, { status: 404 });
    }
    return Response.json(job);
});
