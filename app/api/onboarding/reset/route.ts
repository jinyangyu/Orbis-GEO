import { withDb } from "@/db";
import { requireUserId } from "@/lib/auth/http";
import { withApi } from "@/lib/http/api-error";
import { resetDraft } from "@/lib/onboarding/service";


export const POST = withApi(async (request: Request) => {
    const userId = requireUserId(request);
    const result = await withDb((db) => resetDraft(db, userId));
    return Response.json(result);
});
