import { assertSafeOutboundUrl } from "@/lib/http/safe-url";

export type ErrorContext = Record<string, string | number | boolean | undefined>;

type ReportPayload = {
  message: string;
  name?: string;
  stack?: string;
  context?: ErrorContext;
  time: string;
  env?: string;
};

function serialize(error: unknown, context?: ErrorContext): ReportPayload {
  const err = error instanceof Error ? error : new Error(String(error));
  return {
    message: err.message,
    name: err.name,
    stack: err.stack,
    context,
    time: new Date().toISOString(),
    env: process.env.NODE_ENV,
  };
}

/**
 * Lightweight error reporter.
 * - Always logs structured JSON to console.
 * - If `ORBIS_ERROR_WEBHOOK_URL` is set, POSTs the payload (fire-and-forget).
 * Swap this for Sentry later without touching call sites.
 */
export function reportError(error: unknown, context?: ErrorContext): void {
  const payload = serialize(error, context);
  console.error("[orbis:error]", JSON.stringify(payload));

  const webhook = (process.env.ORBIS_ERROR_WEBHOOK_URL ?? "").trim();
  if (!webhook) return;

  try {
    assertSafeOutboundUrl(webhook);
    void fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => undefined);
  } catch {
    /* ignore webhook failures / blocked URLs */
  }
}

/** Browser-safe alias (no process.env webhook unless injected). */
export function reportClientError(
  error: unknown,
  context?: ErrorContext,
): void {
  const payload = serialize(error, context);
  console.error("[orbis:client-error]", payload);
  try {
    void fetch("/api/client-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: "include",
    }).catch(() => undefined);
  } catch {
    /* ignore */
  }
}
