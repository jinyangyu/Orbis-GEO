export const ORBIS_USER_ID_KEY = "orbis_user_id";
export const ORBIS_USER_ID_HEADER = "x-orbis-user-id";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** UUID v4; works on HTTP LAN IPs where crypto.randomUUID is unavailable. */
export function newUserId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (typeof c?.randomUUID === "function") {
    return c.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof c?.getRandomValues === "function") {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = (Math.random() * 256) | 0;
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Client: get or create local user id in localStorage. */
export function getOrCreateClientUserId(): string {
  try {
    const existing = window.localStorage.getItem(ORBIS_USER_ID_KEY);
    if (existing && isUuid(existing)) return existing;
    const id = newUserId();
    window.localStorage.setItem(ORBIS_USER_ID_KEY, id);
    return id;
  } catch {
    return newUserId();
  }
}

export function authHeaders(userId: string): HeadersInit {
  return { [ORBIS_USER_ID_HEADER]: userId };
}

/** Server: resolve user id from header or cookie. */
export function resolveUserId(request: Request): string | null {
  const header = request.headers.get(ORBIS_USER_ID_HEADER)?.trim();
  if (header && isUuid(header)) return header;

  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)orbis_user_id=([^;]+)/);
  if (match?.[1]) {
    const value = decodeURIComponent(match[1].trim());
    if (isUuid(value)) return value;
  }
  return null;
}

export function requireUserId(request: Request): string {
  const userId = resolveUserId(request);
  if (!userId) {
    throw new UserIdRequiredError();
  }
  return userId;
}

export class UserIdRequiredError extends Error {
  constructor() {
    super(`Missing or invalid ${ORBIS_USER_ID_HEADER}`);
    this.name = "UserIdRequiredError";
  }
}
