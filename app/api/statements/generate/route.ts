import { NextResponse } from "next/server";
import { generateMonthlyStatement, generateMonthlyStatementsForPreviousMonth } from "@/lib/server/monthly-statements";
import { apiError } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GenerateStatementBody = {
  userId?: number;
  year?: number;
  month?: number;
  sendEmail?: boolean;
};

export async function POST(request: Request) {
  const secret = process.env.STATEMENT_CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (secret && auth !== `Bearer ${secret}`) return apiError("Unauthorized", 401);

  const body = await request.json().catch(() => ({})) as GenerateStatementBody;
  const sendEmail = body.sendEmail === true;

  if (body.userId && body.year && body.month) {
    if (body.month < 1 || body.month > 12) return apiError("Bulan statement tidak valid.", 400);
    const result = await generateMonthlyStatement(body.userId, body.year, body.month, sendEmail);
    return NextResponse.json({ ok: true, mode: "single-user", period: { year: body.year, month: body.month }, result });
  }

  const result = await generateMonthlyStatementsForPreviousMonth();
  return NextResponse.json({ ok: true, mode: "previous-month-all-users", ...result });
}
