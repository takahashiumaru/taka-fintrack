import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  let dbStatus = "unknown";
  let dbLatencyMs = 0;
  let errorMessage: string | undefined;

  try {
    // 1. Ensure schemas are properly initialized
    await ensureSchema();

    // 2. Perform a real query to test connection
    const pool = getPool();
    const dbStart = Date.now();
    await pool.query("SELECT 1");
    dbLatencyMs = Date.now() - dbStart;
    dbStatus = "connected";
  } catch (error: any) {
    dbStatus = "disconnected";
    errorMessage = error?.message || String(error);
  }

  const uptime = process.uptime();
  const totalDurationMs = Date.now() - startTime;

  const status = dbStatus === "connected" ? "healthy" : "unhealthy";
  const statusCode = status === "healthy" ? 200 : 503;

  return NextResponse.json(
    {
      status,
      version: "1.0.0",
      uptime: `${Math.floor(uptime)}s`,
      services: {
        database: {
          status: dbStatus,
          latency_ms: dbLatencyMs,
          error: errorMessage,
        },
      },
      latency_ms: totalDurationMs,
    },
    { status: statusCode }
  );
}
