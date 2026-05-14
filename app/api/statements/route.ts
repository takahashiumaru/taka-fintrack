import type { RowDataPacket } from "mysql2";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { ensureSchema, getPool } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StatementRow = RowDataPacket & {
  id: number;
  period_year: number;
  period_month: number;
  file_name: string;
  total_income: number;
  total_expense: number;
  net_cashflow: number;
  opening_balance: number;
  closing_balance: number;
  emailed_at: string | null;
  created_at: string;
};

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return apiError("Sesi tidak valid. Login ulang.", 401);
  await ensureSchema();
  const [rows] = await getPool().execute<StatementRow[]>(`
    SELECT id, period_year, period_month, file_name, total_income, total_expense, net_cashflow, opening_balance, closing_balance, emailed_at, created_at
    FROM monthly_statements
    WHERE user_id = ?
    ORDER BY period_year DESC, period_month DESC
    LIMIT 36
  `, [user.id]);
  return NextResponse.json({ statements: rows.map((row) => ({
    id: Number(row.id),
    periodYear: Number(row.period_year),
    periodMonth: Number(row.period_month),
    fileName: row.file_name,
    totalIncome: Number(row.total_income),
    totalExpense: Number(row.total_expense),
    netCashflow: Number(row.net_cashflow),
    openingBalance: Number(row.opening_balance),
    closingBalance: Number(row.closing_balance),
    emailedAt: row.emailed_at,
    createdAt: row.created_at,
    downloadUrl: `/api/statements/${row.id}/download`,
  })) });
}
