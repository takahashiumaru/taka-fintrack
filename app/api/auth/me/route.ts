import { NextResponse } from "next/server";
import { attachAuthCookie, getAuthenticatedUser, signAuthToken } from "@/lib/server/auth";
import { apiError } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);

  if (!user) return apiError("Sesi tidak valid. Login ulang.", 401);

  const token = signAuthToken(user);
  const response = NextResponse.json({ user, token, authenticated: true });

  return attachAuthCookie(response, token);
}
