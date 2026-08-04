import { NextResponse } from "next/server";
import { getAuthenticatedUser, verifyPassword, hashPassword, UserRow } from "@/lib/server/auth";
import { ensureSchema, getPool } from "@/lib/server/db";
import { apiError, readJson } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return apiError("Sesi tidak valid.", 401);

  const body = await readJson(request);
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return apiError("Password saat ini dan password baru (min 6 karakter) diperlukan.");
  }

  await ensureSchema();
  const pool = getPool();

  const [rows] = await pool.execute<UserRow[]>(
    "SELECT password_hash FROM users WHERE id = ? LIMIT 1",
    [user.id]
  );

  const userRow = rows[0];
  if (!userRow || !verifyPassword(currentPassword, userRow.password_hash)) {
    return apiError("Password saat ini salah.", 401);
  }

  const nextHash = hashPassword(newPassword);

  await pool.execute("UPDATE users SET password_hash = ? WHERE id = ?", [
    nextHash,
    user.id,
  ]);

  return NextResponse.json({ message: "Password berhasil diubah." });
}
