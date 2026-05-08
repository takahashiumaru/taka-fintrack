import { NextResponse } from "next/server";
import { getAuthenticatedUser, hashPassword, normalizeString } from "@/lib/server/auth";
import { ensureSchema, getPool } from "@/lib/server/db";
import { apiError, readJson } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const user = await getAuthenticatedUser(request);

  if (!user) return apiError("Sesi tidak valid. Login ulang.", 401);

  const body = await readJson(request);
  const password = normalizeString(body?.password);

  if (password.length < 6) {
    return apiError("Password baru minimal 6 karakter.");
  }

  await ensureSchema();
  await getPool().execute("UPDATE users SET password_hash = ? WHERE id = ?", [
    hashPassword(password),
    user.id,
  ]);

  return NextResponse.json({ ok: true });
}
