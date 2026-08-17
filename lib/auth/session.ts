import { isUuid, newUserId } from "@/lib/uuid";
import {
  signSessionToken as signToken,
  verifySessionToken as verifyToken,
} from "./session-token";

export { isDevOpenTenant } from "./dev-open-tenant";

export const ORBIS_USER_ID_HEADER = "x-orbis-user-id";
export const SESSION_COOKIE = "orbis_session";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

const DEV_FALLBACK_SECRET = "dev-only-orbis-session-secret-change-me!!";

export function getSessionSecret(): string {
  const s = (process.env.SESSION_SECRET ?? "").trim();
  if (s.length >= 32) return s;
  if ((process.env.NODE_ENV ?? "").trim() === "production") {
    throw new Error("SESSION_SECRET must be set (≥32 characters) in production");
  }
  return DEV_FALLBACK_SECRET;
}

export function cookieSecureFlag(): boolean {
  const raw = (process.env.ORBIS_COOKIE_SECURE ?? "").trim();
  if (raw === "0" || raw.toLowerCase() === "false") return false;
  if (raw === "1" || raw.toLowerCase() === "true") return true;
  return (process.env.NODE_ENV ?? "").trim() === "production";
}

export function signSessionToken(
  userId: string,
  opts?: { expMs?: number; secret?: string; nowMs?: number },
): string {
  const now = opts?.nowMs ?? Date.now();
  return signToken(userId, {
    secret: opts?.secret ?? getSessionSecret(),
    nowMs: now,
    expMs: opts?.expMs ?? now + SESSION_MAX_AGE_SEC * 1000,
  });
}

export function verifySessionToken(
  token: string,
  opts?: { secret?: string; nowMs?: number },
): { userId: string; expMs: number } | null {
  return verifyToken(token, {
    secret: opts?.secret ?? getSessionSecret(),
    nowMs: opts?.nowMs,
  });
}

export function parseCookieHeader(
  cookieHeader: string | null,
  name: string,
): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    if (k !== name) continue;
    return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

export function readSession(
  request: Request,
  opts?: { secret?: string; nowMs?: number },
): { userId: string; expMs: number } | null {
  const raw = parseCookieHeader(
    request.headers.get("cookie"),
    SESSION_COOKIE,
  );
  if (!raw) return null;
  return verifySessionToken(raw, opts);
}

export function buildSessionCookieHeader(userId: string): string {
  const token = signSessionToken(userId);
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_MAX_AGE_SEC}`,
  ];
  if (cookieSecureFlag()) parts.push("Secure");
  return parts.join("; ");
}

export function buildClearSessionCookieHeader(): string {
  const parts = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (cookieSecureFlag()) parts.push("Secure");
  return parts.join("; ");
}

export function requireSession(request: Request): string {
  const session = readSession(request);
  if (!session) {
    throw new SessionRequiredError();
  }
  return session.userId;
}

export class SessionRequiredError extends Error {
  constructor() {
    super("Missing or invalid session cookie");
    this.name = "SessionRequiredError";
  }
}

export function proposedUserIdFromRequest(request: Request): string {
  const header = request.headers.get(ORBIS_USER_ID_HEADER)?.trim();
  if (header && isUuid(header)) return header;
  return newUserId();
}
