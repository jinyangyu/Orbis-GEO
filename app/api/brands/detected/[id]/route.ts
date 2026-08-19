import { withDb } from "@/db";
import { requireUserId } from "@/lib/auth/http";
import { withApi } from "@/lib/http/api-error";
import {
  acceptDetectedBrand,
  dismissDetectedBrand,
} from "@/lib/brands/service";


export const POST = withApi(async (
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) => {
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
});
