import { NextResponse } from "next/server";
import {
  normalizeEmail,
  normalizeString,
  signAuthToken,
  toApiUser,
  verifyPassword,
  type UserRow,
} from "@/lib/server/auth";
import { ensureSchema, getPool } from "@/lib/server/db";
import { apiError, readJson } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await readJson(request);
  const email = normalizeEmail(body?.email);
  const password = normalizeString(body?.password);

  if (!email.includes("@") || !password) {
    return apiError("Email atau password belum valid.");
  }

  await ensureSchema();

  const [rows] = await getPool().execute<UserRow[]>(
    "SELECT id, name, email, password_hash, avatar_url FROM users WHERE email = ? LIMIT 1",
    [email],
  );
  const row = rows[0];

  if (!row || !verifyPassword(password, row.password_hash)) {
    return apiError("Email atau password salah.", 401);
  }

  const user = toApiUser(row);

  return NextResponse.json({
    user,
    token: signAuthToken(user),
  });
}
