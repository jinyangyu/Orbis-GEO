import { createHmac, timingSafeEqual } from "node:crypto";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function b64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function fromB64url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function hmac(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Sign session token: base64url(userId).base64url(expMs).sig */
export function signSessionToken(
  userId: string,
  opts: { expMs?: number; secret: string; nowMs?: number },
): string {
  if (!isUuid(userId)) throw new Error("Invalid userId for session");
  const now = opts.nowMs ?? Date.now();
  const expMs = opts.expMs ?? now + 60 * 60 * 24 * 30 * 1000;
  const payload = `${b64url(userId)}.${b64url(String(expMs))}`;
  return `${payload}.${hmac(payload, opts.secret)}`;
}

export function verifySessionToken(
  token: string,
  opts: { secret: string; nowMs?: number },
): { userId: string; expMs: number } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [uidB, expB, sig] = parts;
  if (!uidB || !expB || !sig) return null;
  const payload = `${uidB}.${expB}`;
  const expected = hmac(payload, opts.secret);
  if (!safeEqual(sig, expected)) return null;
  const expMs = Number(fromB64url(expB));
  const now = opts.nowMs ?? Date.now();
  if (!Number.isFinite(expMs) || expMs < now) return null;
  const userId = fromB64url(uidB);
  if (!isUuid(userId)) return null;
  return { userId, expMs };
}
