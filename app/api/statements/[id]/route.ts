import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { ensureSchema, getPool } from "@/lib/server/db";
import { apiError, handleApiError } from "@/lib/server/http";
import type { RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface StatementRow extends RowDataPacket {
  id: number;
  user_id: number;
  month: string;
  file_name: string;
  file_size: number;
  income: number;
  expense: number;
  net_savings: number;
  created_at: string;
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError("Sesi tidak valid. Login ulang.", 401);

    const id = Number(params.id);
    if (!Number.isFinite(id) || id <= 0) return apiError("ID statement tidak valid.", 400);

    await ensureSchema();

    const [rows] = await getPool().execute<StatementRow[]>(
      `SELECT id, user_id, month, file_name, file_size, income, expense, net_savings, created_at
       FROM monthly_statements
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [id, user.id],
    );

    if (rows.length === 0) return apiError("Statement tidak ditemukan.", 404);

    return NextResponse.json({ statement: rows[0] });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
