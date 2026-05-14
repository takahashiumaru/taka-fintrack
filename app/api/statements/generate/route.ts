import { NextResponse } from "next/server";
import { generateMonthlyStatementsForPreviousMonth } from "@/lib/server/monthly-statements";
import { apiError } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.STATEMENT_CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (secret && auth !== `Bearer ${secret}`) return apiError("Unauthorized", 401);

  const result = await generateMonthlyStatementsForPreviousMonth();
  return NextResponse.json({ ok: true, ...result });
}
