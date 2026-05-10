import type { ResultSetHeader } from "mysql2";
import { NextResponse } from "next/server";
import {
  hashPassword,
  normalizeEmail,
  normalizeString,
  attachAuthCookie,
  signAuthToken,
  toApiUser,
  type UserRow,
} from "@/lib/server/auth";
import { ensureSchema, getPool } from "@/lib/server/db";
import { apiError, readJson } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await readJson(request);
  const name = normalizeString(body?.name);
  const email = normalizeEmail(body?.email);
  const password = normalizeString(body?.password);

  if (!name) return apiError("Nama wajib diisi.");
  if (!email.includes("@")) return apiError("Email belum valid.");
  if (password.length < 6) return apiError("Password minimal 6 karakter.");

  await ensureSchema();

  const pool = getPool();
  const [existingRows] = await pool.execute<UserRow[]>(
    "SELECT id, name, email, password_hash, avatar_url FROM users WHERE email = ? LIMIT 1",
    [email],
  );

  if (existingRows.length > 0) {
    return apiError("Email sudah terdaftar. Pakai login.", 409);
  }

  const [result] = await pool.execute<ResultSetHeader>(
    "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
    [name, email, hashPassword(password)],
  );
  const [rows] = await pool.execute<UserRow[]>(
    "SELECT id, name, email, password_hash, avatar_url FROM users WHERE id = ? LIMIT 1",
    [result.insertId],
  );
  const user = toApiUser(rows[0]);

  const token = signAuthToken(user);
  const response = NextResponse.json({ user, token, authenticated: true });

  return attachAuthCookie(response, token);
}
