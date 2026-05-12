import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/server/db";

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

export async function checkPersistentRateLimit(key: string, limit: number, windowMs: number) {
  const pool = getPool();
  const resetAtSql = `DATE_ADD(NOW(), INTERVAL ${Math.max(1, Math.ceil(windowMs / 1000))} SECOND)`;

  await pool.execute("DELETE FROM rate_limit_buckets WHERE reset_at < NOW()");
  await pool.execute(
    `
      INSERT INTO rate_limit_buckets (rate_key, count, reset_at)
      VALUES (?, 1, ${resetAtSql})
      ON DUPLICATE KEY UPDATE
        count = IF(reset_at <= NOW(), 1, count + 1),
        reset_at = IF(reset_at <= NOW(), ${resetAtSql}, reset_at)
    `,
    [key],
  );

  const [rows] = await pool.execute<Array<RowDataPacket & { count: number; reset_at_ms: number }>>(
    "SELECT count, UNIX_TIMESTAMP(reset_at) * 1000 AS reset_at_ms FROM rate_limit_buckets WHERE rate_key = ? LIMIT 1",
    [key],
  );
  const bucket = rows[0];
  const count = Number(bucket?.count ?? 1);
  const resetAt = Number(bucket?.reset_at_ms ?? Date.now() + windowMs);

  if (count > limit) {
    return { ok: false, remaining: 0, resetAt };
  }

  return { ok: true, remaining: Math.max(0, limit - count), resetAt };
}
