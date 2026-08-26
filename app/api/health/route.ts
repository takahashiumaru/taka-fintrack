import { NextResponse } from "next/server";
import { getVersion } from "@/lib/server/version";
import { ensureSchema, getPool } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  let dbStatus = "unknown";
  let dbLatencyMs = 0;
  let errorMessage: string | undefined;

  try {
    await ensureSchema();
    const pool = getPool();
    const dbStart = Date.now();
    await pool.query("SELECT 1");
    dbLatencyMs = Date.now() - dbStart;
    dbStatus = "connected";
  } catch (error: unknown) {
    dbStatus = "disconnected";
    errorMessage = error instanceof Error ? error.message : String(error);
  }

  const uptime = process.uptime();
  const totalDurationMs = Date.now() - startTime;
  const memoryUsage = process.memoryUsage();

  const status = dbStatus === "connected" ? "healthy" : "unhealthy";
  const statusCode = status === "healthy" ? 200 : 503;

  return NextResponse.json(
    {
      status,
      version: getVersion(),
      uptime: `${Math.floor(uptime)}s`,
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      },
      services: {
        database: {
          status: dbStatus,
          latency_ms: dbLatencyMs,
          error: errorMessage,
        },
      },
      total_latency_ms: totalDurationMs,
    },
    { status: statusCode }
  );
}
