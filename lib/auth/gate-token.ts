import { createHmac, timingSafeEqual } from "node:crypto";

export const GATE_MAX_AGE_SEC = 60 * 60 * 24 * 14; // 14 days

function hmacDigest(value: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(value).digest();
}

function safeEqualStr(a: string, b: string, secret: string): boolean {
  const ha = hmacDigest(a, secret);
  const hb = hmacDigest(b, secret);
  return timingSafeEqual(ha, hb);
}

function b64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function fromB64url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqualSig(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function credentialsMatch(
  username: string,
  password: string,
  expectedUser: string,
  expectedPassword: string,
  secret: string,
): boolean {
  if (!expectedUser || !expectedPassword) return false;
  const uOk = safeEqualStr(username.trim(), expectedUser, secret);
  const pOk = safeEqualStr(password, expectedPassword, secret);
  return uOk && pOk;
}

/** Token format: gate.base64url(expMs).sig */
export function signGateToken(opts: {
  secret: string;
  expMs?: number;
  nowMs?: number;
}): string {
  const now = opts.nowMs ?? Date.now();
  const expMs = opts.expMs ?? now + GATE_MAX_AGE_SEC * 1000;
  const payload = `gate.${b64url(String(expMs))}`;
  return `${payload}.${signPayload(payload, opts.secret)}`;
}

export function verifyGateToken(
  token: string,
  opts: { secret: string; nowMs?: number },
): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [kind, expB, sig] = parts;
  if (kind !== "gate" || !expB || !sig) return false;
  const payload = `${kind}.${expB}`;
  if (!safeEqualSig(sig, signPayload(payload, opts.secret))) return false;
  const expMs = Number(fromB64url(expB));
  const now = opts.nowMs ?? Date.now();
  return Number.isFinite(expMs) && expMs >= now;
}
