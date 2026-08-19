/** Auth failure codes for API JSON. Keep this module free of `@/` so unit tests can import it. */

export type AuthFailure = {
  code: "GATE_REQUIRED" | "SESSION_REQUIRED";
  message: string;
};

export function authFailure(error: unknown): AuthFailure | null {
  if (!(error instanceof Error)) return null;
  if (error.name === "GateRequiredError") {
    return { code: "GATE_REQUIRED", message: error.message };
  }
  if (
    error.name === "SessionRequiredError" ||
    error.name === "UserIdRequiredError"
  ) {
    return { code: "SESSION_REQUIRED", message: error.message };
  }
  return null;
}
