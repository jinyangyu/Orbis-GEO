import {
  cookieSecureFlag,
  getSessionSecret,
  parseCookieHeader,
} from "@/lib/auth/session";
import {
  GATE_MAX_AGE_SEC,
  credentialsMatch,
  signGateToken as signToken,
  verifyGateToken as verifyToken,
} from "@/lib/auth/gate-token";

export { GATE_MAX_AGE_SEC };
export const GATE_COOKIE = "orbis_gate";

export class GateRequiredError extends Error {
  constructor() {
    super("Login required");
    this.name = "GateRequiredError";
  }
}

export function getGateUser(): string {
  return (process.env.ORBIS_GATE_USER ?? "").trim();
}

export function getGatePassword(): string {
  return (process.env.ORBIS_GATE_PASSWORD ?? "").trim();
}

/** Gate is on only when both user and password are configured. */
export function isGateEnabled(): boolean {
  return Boolean(getGateUser() && getGatePassword());
}

export function verifyGateCredentials(
  username: string,
  password: string,
  opts?: { secret?: string },
): boolean {
  if (!isGateEnabled()) return false;
  return credentialsMatch(
    username,
    password,
    getGateUser(),
    getGatePassword(),
    opts?.secret ?? getSessionSecret(),
  );
}

export function signGateToken(opts?: {
  expMs?: number;
  secret?: string;
  nowMs?: number;
}): string {
  return signToken({
    secret: opts?.secret ?? getSessionSecret(),
    nowMs: opts?.nowMs,
    expMs: opts?.expMs,
  });
}

export function verifyGateToken(
  token: string,
  opts?: { secret?: string; nowMs?: number },
): boolean {
  return verifyToken(token, {
    secret: opts?.secret ?? getSessionSecret(),
    nowMs: opts?.nowMs,
  });
}

export function readGateOk(
  request: Request,
  opts?: { secret?: string; nowMs?: number },
): boolean {
  if (!isGateEnabled()) return true;
  const raw = parseCookieHeader(request.headers.get("cookie"), GATE_COOKIE);
  if (!raw) return false;
  return verifyGateToken(raw, opts);
}

export function assertGate(request: Request): void {
  if (!isGateEnabled()) return;
  if (!readGateOk(request)) throw new GateRequiredError();
}

export function buildGateCookieHeader(token: string): string {
  const parts = [
    `${GATE_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${GATE_MAX_AGE_SEC}`,
  ];
  if (cookieSecureFlag()) parts.push("Secure");
  return parts.join("; ");
}

export function buildClearGateCookieHeader(): string {
  const parts = [
    `${GATE_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (cookieSecureFlag()) parts.push("Secure");
  return parts.join("; ");
}
