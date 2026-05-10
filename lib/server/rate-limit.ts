type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastCleanupAt = 0;
const cleanupIntervalMs = 60_000;

function cleanupExpiredBuckets(now: number) {
  if (now - lastCleanupAt < cleanupIntervalMs) return;
  lastCleanupAt = now;

  buckets.forEach((bucket, key) => {
    if (bucket.resetAt <= now) buckets.delete(key);
  });
}

export function getClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  cleanupExpiredBuckets(now);

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (bucket.count >= limit) {
    return { ok: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  return { ok: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}
