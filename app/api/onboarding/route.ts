import { withDb } from "@/db";
import { UserIdRequiredError, requireUserId } from "@/lib/identity";
import { getDraftSession, upsertDraft } from "@/lib/onboarding/service";
import { isValidOnboardingState } from "@/lib/onboarding/validate";

function errorResponse(error: unknown) {
  if (error instanceof UserIdRequiredError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  const cause =
    error instanceof Error && error.cause instanceof Error
      ? error.cause.message
      : "";
  const combined = cause ? `${message} (${cause})` : message;
  const status = message.includes("DATABASE_URL") ? 503 : 500;
  return Response.json({ error: combined }, { status });
}

export async function GET(request: Request) {
  try {
    const userId = requireUserId(request);
    const draft = await withDb((db) => getDraftSession(db, userId));
    if (!draft) {
      return new Response(null, { status: 204 });
    }
    return Response.json({ sessionId: draft.sessionId, draft: draft.draft });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const userId = requireUserId(request);
    const body = await request.json();
    if (!isValidOnboardingState(body)) {
      return Response.json({ error: "Invalid onboarding state" }, { status: 400 });
    }
    const result = await withDb((db) => upsertDraft(db, userId, body));
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
