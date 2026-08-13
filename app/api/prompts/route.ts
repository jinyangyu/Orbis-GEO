import { withDb } from "@/db";
import { UserIdRequiredError, requireUserId } from "@/lib/identity";
import { getWorkspaceForUser } from "@/lib/onboarding/service";
import { appendPromptsFromResearch } from "@/lib/prompt-research/service";

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
        : 500;
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
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
  } catch (error) {
    return errorResponse(error);
  }
}
