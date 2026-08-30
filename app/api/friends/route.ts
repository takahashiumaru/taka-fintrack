import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { ensureSchema } from "@/lib/server/db";
import { apiError, handleApiError } from "@/lib/server/http";
import { listFriends } from "@/lib/server/social";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return apiError("Sesi tidak valid. Login ulang.", 401);

  try {
    await ensureSchema();
    return NextResponse.json(await listFriends(user.id));
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
