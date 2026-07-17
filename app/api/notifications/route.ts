import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { ensureSchema, getPool } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";
import { listNotifications } from "@/lib/server/social";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return apiError("Sesi tidak valid. Login ulang.", 401);

  await ensureSchema();
  return NextResponse.json(await listNotifications(user.id));
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return apiError("Sesi tidak valid. Login ulang.", 401);

  await ensureSchema();
  const [result] = await getPool().execute<{ affectedRows: number } & import("mysql2").ResultSetHeader>(
    "UPDATE notifications SET status = 'read', read_at = COALESCE(read_at, NOW()) WHERE recipient_user_id = ? AND status = 'unread'",
    [user.id]
  );
  return NextResponse.json({ updated: result.affectedRows });
}
