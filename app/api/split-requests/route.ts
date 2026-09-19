import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { ensureSchema } from "@/lib/server/db";
import { apiError, handleApiError, readJson } from "@/lib/server/http";
import { createSplitRequest, listSplitRequests, SocialError } from "@/lib/server/social";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return apiError("Sesi tidak valid. Login ulang.", 401);

  try {
    await ensureSchema();
    return NextResponse.json(await listSplitRequests(user.id));
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return apiError("Sesi tidak valid. Login ulang.", 401);

  const body = await readJson(request);

  try {
    await ensureSchema();
    const result = await createSplitRequest(user, body ?? {});
    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof SocialError) return apiError(error.message, error.status);
    return handleApiError(error);
  }
}
