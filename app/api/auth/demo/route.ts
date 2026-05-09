import { NextResponse } from "next/server";
import { hashPassword, signAuthToken, toApiUser, type UserRow } from "@/lib/server/auth";
import { ensureSchema, getPool } from "@/lib/server/db";
import { apiError, isEnabled } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!isEnabled(process.env.ENABLE_DEMO_LOGIN)) {
    return apiError("Demo login dimatikan di production.", 404);
  }

  await ensureSchema();

  const pool = getPool();

  await pool.execute(
    `
      INSERT INTO users (name, email, password_hash)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        password_hash = VALUES(password_hash)
    `,
    ["Andi Pratama", "andi@taka.id", hashPassword("demo1234")],
  );

  const [rows] = await pool.execute<UserRow[]>(
    "SELECT id, name, email, password_hash, avatar_url FROM users WHERE email = ? LIMIT 1",
    ["andi@taka.id"],
  );
  const user = toApiUser(rows[0]);

  return NextResponse.json({
    user,
    token: signAuthToken(user),
  });
}
