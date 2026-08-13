import { withDb } from "@/db";
import { setPromptActive } from "@/lib/brand-settings/service";
import { UserIdRequiredError, requireUserId } from "@/lib/identity";

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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
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
  } catch (error) {
    return errorResponse(error);
  }
}
