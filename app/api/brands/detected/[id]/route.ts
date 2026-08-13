import { withDb } from "@/db";
import { UserIdRequiredError, requireUserId } from "@/lib/identity";
import {
  acceptDetectedBrand,
  dismissDetectedBrand,
} from "@/lib/brands/service";

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
        : message.includes("not in detected")
          ? 400
          : 500;
  return Response.json({ error: message }, { status });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const userId = requireUserId(request);
    const params = await Promise.resolve(context.params);
    const url = new URL(request.url);
    const action =
      url.searchParams.get("action") ||
      ((await request.json().catch(() => ({}))) as { action?: string }).action ||
      "accept";

    const brand = await withDb((db) =>
      action === "dismiss"
        ? dismissDetectedBrand(db, userId, params.id)
        : acceptDetectedBrand(db, userId, params.id),
    );
    return Response.json(brand);
  } catch (error) {
    return errorResponse(error);
  }
}
