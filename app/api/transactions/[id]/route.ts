import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { ensureSchema, getPool } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";
import type { ResultSetHeader } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getAuthenticatedUser(request);
  if (!user) return apiError("Sesi tidak valid. Login ulang.", 401);

  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) return apiError("ID transaksi tidak valid.", 400);

  await ensureSchema();

  const [result] = await getPool().execute<ResultSetHeader>(
    "DELETE FROM transactions WHERE id = ? AND user_id = ? LIMIT 1",
    [id, user.id],
  );

  if (result.affectedRows === 0) {
    return apiError("Transaksi tidak ditemukan.", 404);
  }

  return NextResponse.json({ success: true });
}
