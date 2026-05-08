import { NextResponse } from "next/server";

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();

    return value && typeof value === "object" ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}
