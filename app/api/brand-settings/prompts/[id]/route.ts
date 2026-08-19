import { withDb } from "@/db";
import { setPromptActive } from "@/lib/brand-settings/service";
import { requireUserId } from "@/lib/auth/http";
import { withApi } from "@/lib/http/api-error";


export const PATCH = withApi(async (
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) => {
    const userId = requireUserId(request);
    const params = await Promise.resolve(context.params);
    const body = (await request.json()) as { isActive?: boolean };
    if (typeof body.isActive !== "boolean") {
      return Response.json({ error: "isActive 必填" }, { status: 400 });
    }
    const prompt = await withDb((db) =>
      setPromptActive(db, userId, params.id, body.isActive!),
    );
    return Response.json(prompt);
});
