import type { RowDataPacket } from "mysql2";
import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSchema();

  const [rows] = await getPool().query<RowDataPacket[]>("SELECT 1 AS ok");

  return NextResponse.json({
    ok: true,
    database: rows.length > 0 ? "connected" : "unknown",
  });
}
