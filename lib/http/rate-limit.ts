/**
 * In-memory sliding window limiter (per isolate). Fine for single-instance / Workers.
 */
type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

export type RateLimitOpts = {
  windowMs: number;
  max: number;
};

export function allowRateLimit(
  key: string,
  opts: RateLimitOpts,
  nowMs = Date.now(),
): boolean {
  const windowMs = Math.max(1, opts.windowMs);
  const max = Math.max(1, opts.max);
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }
  const cutoff = nowMs - windowMs;
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);
  if (bucket.timestamps.length >= max) return false;
  bucket.timestamps.push(nowMs);
  return true;
}

/** Reset buckets (unit tests). */
export function resetRateLimitBuckets() {
  buckets.clear();
}

export function clientIp(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const xff = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (xff) return xff;
  return "unknown";
}

export function tooManyRequests(retryAfterSec = 30) {
  return Response.json(
    { error: "请求过于频繁，请稍后再试" },
    {
      status: 429,
      headers: { "retry-after": String(retryAfterSec) },
    },
  );
}

/** Light write-path limiter: 60 req / min / IP. */
export function allowWriteRequest(request: Request): boolean {
  return allowRateLimit(`write:${clientIp(request)}`, {
    windowMs: 60_000,
    max: 60,
  });
}

/** Return 429 response when the write limiter trips; otherwise null. */
export function writeRateLimited(request: Request): Response | null {
  if (allowWriteRequest(request)) return null;
  return tooManyRequests(60);
}
