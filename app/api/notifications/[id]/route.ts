import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { ensureSchema } from "@/lib/server/db";
import { apiError, readJson } from "@/lib/server/http";
import { actOnNotification, SocialError } from "@/lib/server/social";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await getAuthenticatedUser(request);
  if (!user) return apiError("Sesi tidak valid. Login ulang.", 401);

  const notificationId = Number(params.id);
  const body = await readJson(request);
  const action = body?.action === "read" || body?.action === "accept" || body?.action === "reject" ? body.action : null;

  if (!action) return apiError("Aksi notifikasi belum valid.");

  try {
    await ensureSchema();
    return NextResponse.json(await actOnNotification(user.id, notificationId, action));
  } catch (error: unknown) {
    if (error instanceof SocialError) return apiError((error as SocialError).message, (error as SocialError).status);
    throw error;
  }
}
