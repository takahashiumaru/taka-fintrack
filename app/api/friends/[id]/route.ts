import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { ensureSchema } from "@/lib/server/db";
import { apiError, readJson } from "@/lib/server/http";
import { actOnFriendship, deleteFriendship, SocialError } from "@/lib/server/social";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await getAuthenticatedUser(request);
  if (!user) return apiError("Sesi tidak valid. Login ulang.", 401);

  const friendshipId = Number(params.id);
  const body = await readJson(request);
  const action = body?.action === "accept" ? "accept" : body?.action === "reject" ? "reject" : null;

  if (!action) return apiError("Aksi friend request belum valid.");

  try {
    await ensureSchema();
    return NextResponse.json(await actOnFriendship(user.id, friendshipId, action));
  } catch (error) {
    if (error instanceof SocialError) return apiError(error.message, error.status);
    throw error;
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const user = await getAuthenticatedUser(request);
  if (!user) return apiError("Sesi tidak valid. Login ulang.", 401);

  const friendshipId = Number(params.id);

  try {
    await ensureSchema();
    return NextResponse.json(await deleteFriendship(user.id, friendshipId));
  } catch (error) {
    if (error instanceof SocialError) return apiError(error.message, error.status);
    throw error;
  }
}
