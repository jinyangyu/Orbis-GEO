import { withDb } from "@/db";
import { requireUserId } from "@/lib/auth/http";
import { withApi } from "@/lib/http/api-error";
import { getWorkspaceForUser } from "@/lib/onboarding/service";
import { appendPromptsFromResearch } from "@/lib/prompt-research/service";


export const POST = withApi(async (request: Request) => {
    const userId = requireUserId(request);
    const body = (await request.json()) as {
      workspaceId?: string;
      texts?: string[];
      market?: string;
      intentByText?: Record<string, string>;
    };

    const texts = Array.isArray(body.texts) ? body.texts : [];
    if (!texts.length) {
      return Response.json({ error: "请至少选择一条 Prompt" }, { status: 400 });
    }

    const result = await withDb(async (db) => {
      let workspaceId = body.workspaceId?.trim();
      let market = body.market?.trim() || "";
      if (!workspaceId) {
        const ws = await getWorkspaceForUser(db, userId);
        workspaceId = ws?.workspace.id;
        market = market || ws?.brand?.market || "";
      }
      if (!workspaceId) throw new Error("Workspace not found");
      return appendPromptsFromResearch(
        db,
        userId,
        workspaceId,
        texts,
        market,
        body.intentByText,
      );
    });

    return Response.json(result);
});
