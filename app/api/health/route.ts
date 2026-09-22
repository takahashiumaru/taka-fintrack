import * as fs from "fs";
import * as path from "path";
import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getVersion(): Promise<string> {
  try {
    const pkg = JSON.parse(await fs.promises.readFile(path.join(process.cwd(), "package.json"), "utf8"));
    return pkg.version ?? "1.0.0";
  } catch {
    return "1.0.0";
  }
}

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
  const formatBytes = (bytes: number) => `${Math.round(bytes / 1024 / 1024)}MB`;

  const status = dbStatus === "connected" ? "healthy" : "unhealthy";
  const statusCode = status === "healthy" ? 200 : 503;

  return NextResponse.json(
    {
      status,
      version: await getVersion(),
      uptime: `${Math.floor(uptime)}s`,
      memory: {
        rss: formatBytes(memoryUsage.rss),
        heapUsed: formatBytes(memoryUsage.heapUsed),
        heapTotal: formatBytes(memoryUsage.heapTotal),
        external: formatBytes(memoryUsage.external),
      },
      system: {
        platform: process.platform,
        arch: process.arch,
        node: process.version,
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
