import { authFailure } from "./auth-error-code";

export type ApiErrorOptions = {
  /** Override status after built-in auth / message mappings. */
  statusFor?: (error: unknown, message: string) => number | undefined;
};

function defaultStatusForMessage(message: string): number {
  if (
    message.includes("DATABASE_URL") ||
    message.includes("SESSION_SECRET") ||
    message.includes("S3")
  ) {
    return 503;
  }
  if (message.includes("not found") || message.includes("access denied")) {
    return 404;
  }
  if (message.includes("超过") || message.includes("空文件")) {
    return 400;
  }
  return 500;
}

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Unexpected error";
  const cause =
    error.cause instanceof Error ? error.cause.message : "";
  return cause ? `${error.message} (${cause})` : error.message;
}

/** Map thrown errors to JSON responses. Gate vs session stay distinct 401s. */
export function errorResponse(
  error: unknown,
  options?: ApiErrorOptions,
): Response {
  const auth = authFailure(error);
  if (auth) {
    return Response.json(
      { error: auth.message, code: auth.code },
      { status: 401 },
    );
  }

  const message = errorMessage(error);
  const override = options?.statusFor?.(error, message);
  const status = override ?? defaultStatusForMessage(message);
  return Response.json({ error: message }, { status });
}

export function withApi<C = unknown>(
  handler: (request: Request, ctx: C) => Promise<Response>,
  options?: ApiErrorOptions,
): (request: Request, ctx: C) => Promise<Response> {
  return async (request: Request, ctx: C) => {
    try {
      return await handler(request, ctx);
    } catch (error) {
      return errorResponse(error, options);
    }
  };
}
