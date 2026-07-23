import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { ensureSchema } from "@/lib/server/db";
import { apiError, readJson } from "@/lib/server/http";
import { createFriendRequest, SocialError } from "@/lib/server/social";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return apiError("Sesi tidak valid. Login ulang.", 401);

  const body = await readJson(request);

  try {
    await ensureSchema();
    const result = await createFriendRequest(user, body?.email);
    return NextResponse.json(result, { status: result.alreadyPending ? 200 : 201 });
  } catch (error: unknown) {
    if (error instanceof SocialError) return apiError(error.message, error.status);
    throw error;
  }
}
