import { NextResponse } from "next/server";
import { getAuthenticatedUser, normalizeString } from "@/lib/server/auth";
import { ensureSchema, getPool } from "@/lib/server/db";
import { apiError, readJson } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const user = await getAuthenticatedUser(request);

  if (!user) return apiError("Sesi tidak valid. Login ulang.", 401);

  const body = await readJson(request);
  const nextName = normalizeString(body?.name) || user.name;
  let nextAvatarUrl = user.avatarUrl;

  if (Object.prototype.hasOwnProperty.call(body ?? {}, "avatarUrl")) {
    const avatarUrl = body?.avatarUrl;

    if (avatarUrl === null || avatarUrl === "") {
      nextAvatarUrl = null;
    } else if (typeof avatarUrl === "string" && avatarUrl.startsWith("data:image/") && avatarUrl.length <= 2_800_000) {
      nextAvatarUrl = avatarUrl;
    } else {
      return apiError("Foto profil harus berupa data image dan maksimal 2MB.");
    }
  }

  await ensureSchema();
  await getPool().execute("UPDATE users SET name = ?, avatar_url = ? WHERE id = ?", [
    nextName,
    nextAvatarUrl,
    user.id,
  ]);

  return NextResponse.json({
    user: {
      ...user,
      name: nextName,
      avatarUrl: nextAvatarUrl,
    },
  });
}
