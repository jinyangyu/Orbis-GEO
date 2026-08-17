import { reportError } from "@/lib/observability/report-error";
import { UserIdRequiredError, requireUserId } from "@/lib/auth/http";
import {
  allowRateLimit,
  clientIp,
  tooManyRequests,
} from "@/lib/http/rate-limit";

/** Accept browser error reports; forward to the same reporter/webhook pipeline. */
export async function POST(request: Request) {
  if (
    !allowRateLimit(`client-error-ip:${clientIp(request)}`, {
      windowMs: 60_000,
      max: 20,
    })
  ) {
    return tooManyRequests(60);
  }
  try {
    const userId = requireUserId(request);
    if (
      !allowRateLimit(`client-error:${userId}`, {
        windowMs: 60_000,
        max: 10,
      })
    ) {
      return tooManyRequests(60);
    }
  } catch (error) {
    if (error instanceof UserIdRequiredError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    throw error;
  }

  try {
    const body = (await request.json().catch(() => null)) as {
      message?: string;
      name?: string;
      stack?: string;
      context?: Record<string, string | number | boolean | undefined>;
    } | null;

    const message = body?.message?.slice(0, 500) || "client error";
    const err = new Error(message);
    if (body?.name) err.name = String(body.name).slice(0, 120);
    if (body?.stack) err.stack = String(body.stack).slice(0, 4000);

    reportError(err, {
      ...(body?.context ?? {}),
      source: "client",
    });

    return Response.json({ ok: true });
  } catch (error) {
    reportError(error, { source: "api.client-error" });
    return Response.json({ ok: false }, { status: 500 });
  }
}
