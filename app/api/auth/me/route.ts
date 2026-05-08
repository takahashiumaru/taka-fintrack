import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { apiError } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);

  if (!user) return apiError("Sesi tidak valid. Login ulang.", 401);

  return NextResponse.json({ user });
}
