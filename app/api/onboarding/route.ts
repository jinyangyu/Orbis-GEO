import { withDb } from "@/db";
import { requireUserId } from "@/lib/auth/http";
import { withApi } from "@/lib/http/api-error";
import { getDraftSession, upsertDraft } from "@/lib/onboarding/service";
import { isValidOnboardingState } from "@/lib/onboarding/validate";


export const GET = withApi(async (request: Request) => {
    const userId = requireUserId(request);
    const draft = await withDb((db) => getDraftSession(db, userId));
    if (!draft) {
      return new Response(null, { status: 204 });
    }
    return Response.json({ sessionId: draft.sessionId, draft: draft.draft });
});

export const PUT = withApi(async (request: Request) => {
    const userId = requireUserId(request);
    const body = await request.json();
    if (!isValidOnboardingState(body)) {
      return Response.json({ error: "Invalid onboarding state" }, { status: 400 });
    }
    const result = await withDb((db) => upsertDraft(db, userId, body));
    return Response.json(result);
});
