import { NextResponse } from "next/server";
import { ensureSchema } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSchema();

  return NextResponse.json({ ok: true });
}
