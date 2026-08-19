import { withDb } from "@/db";
import { requireUserId } from "@/lib/auth/http";
import { withApi } from "@/lib/http/api-error";
import { completeOnboarding } from "@/lib/onboarding/service";
import { isValidOnboardingState } from "@/lib/onboarding/validate";


export const POST = withApi(async (request: Request) => {
    const userId = requireUserId(request);
    const body = await request.json();
    if (!isValidOnboardingState(body)) {
      return Response.json({ error: "Invalid onboarding state" }, { status: 400 });
    }
    const result = await withDb((db) => completeOnboarding(db, userId, body));
    return Response.json(result);
});
