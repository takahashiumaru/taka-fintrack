import type { RowDataPacket } from "mysql2";
import { NextResponse } from "next/server";
import { hashPassword, normalizeEmail, normalizeString, hashResetToken } from "@/lib/server/auth";
import { ensureSchema, getPool } from "@/lib/server/db";
import { apiError, readJson } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ResetTokenRow = RowDataPacket & {
  id: number;
  user_id: number;
  email: string;
  expires_at: Date | string;
  used_at: Date | string | null;
};

export async function POST(request: Request) {
  const body = await readJson(request);
  const token = normalizeString(body?.token);
  const email = normalizeEmail(body?.email);
  const password = normalizeString(body?.password);

  if (!email.includes("@") || token.length < 32) return apiError("Link reset tidak valid atau sudah kedaluwarsa.", 400);
  if (password.length < 6) return apiError("Password baru minimal 6 karakter.", 400);

  await ensureSchema();
  const pool = getPool();
  const tokenHash = hashResetToken(token);

  const [rows] = await pool.execute<ResetTokenRow[]>(
    `SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at, users.email
     FROM password_reset_tokens prt
     JOIN users ON users.id = prt.user_id
     WHERE prt.token_hash = ? AND users.email = ?
     LIMIT 1`,
    [tokenHash, email],
  );

  const row = rows[0];
  if (!row || row.used_at) {
    return apiError("Link reset tidak valid atau sudah kedaluwarsa.", 400);
  }

  const [[expiryStatus]] = await pool.query<Array<RowDataPacket & { is_expired: 0 | 1 }>>(
    "SELECT ? < NOW() AS is_expired",
    [row.expires_at],
  );
  if (expiryStatus?.is_expired) {
    return apiError("Link reset tidak valid atau sudah kedaluwarsa.", 400);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute("UPDATE users SET password_hash = ? WHERE id = ?", [hashPassword(password), row.user_id]);
    await connection.execute("UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?", [row.id]);
    await connection.execute("UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL", [row.user_id]);
    await connection.commit();
  } catch (error: unknown) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return NextResponse.json({ success: true });
}
