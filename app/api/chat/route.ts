import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { apiError, handleApiError, isAbortError, readJson, tooManyRequests, withTimeout } from "@/lib/server/http";
import { checkPersistentRateLimit, getClientIp } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxMessages = 20;
const maxUserMessageLength = 2_000;
const maxSystemMessageLength = 16_000;
const maxRequestsPerMinute = 20;
const aiTimeoutMs = 30_000;

type ChatMessage = {
  role?: unknown;
  content?: unknown;
};

function validateMessages(value: unknown) {
  if (!Array.isArray(value) || value.length === 0 || value.length > maxMessages) return null;

  const messages = value.map((message: ChatMessage) => {
    const role = message?.role;
    const content = message?.content;

    if (!["system", "user", "assistant"].includes(String(role))) return null;
    if (typeof content !== "string" || content.trim().length === 0) return null;

    const maxLength = role === "system" ? maxSystemMessageLength : maxUserMessageLength;
    if (content.length > maxLength) return null;

    return { role, content: content.trim() };
  });

  return messages.every(Boolean) ? messages : null;
}

export async function POST(req: NextRequest) {
  const timeout = withTimeout(aiTimeoutMs);

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return apiError("Sesi tidak valid. Login ulang.", 401);

    const rateLimit = await checkPersistentRateLimit(`chat:${user.id}:${getClientIp(req)}`, maxRequestsPerMinute, 60_000);
    if (!rateLimit.ok) return tooManyRequests(rateLimit.resetAt);

    const body = await readJson(req);
    const messages = validateMessages(body?.messages);

    if (!messages) {
      return apiError(`messages wajib 1-${maxMessages} item. Pesan user/asisten maksimal ${maxUserMessageLength} karakter, pesan system maksimal ${maxSystemMessageLength} karakter.`);
    }

    if (!process.env.AI_API_URL || !process.env.AI_API_KEY) {
      return apiError("Konfigurasi AI belum tersedia.", 503);
    }

    const aiResponse = await fetch(process.env.AI_API_URL, {
      method: "POST",
      signal: timeout.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "full-support",
        messages,
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI Chat API upstream error", { status: aiResponse.status });
      return apiError("AI chat sedang bermasalah. Coba lagi sebentar.", 502);
    }

    return new Response(aiResponse.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: unknown) {
    if (isAbortError(error)) {
      return apiError("AI sedang lambat. Coba lagi sebentar.", 504);
    }

    console.error("AI Chat Error:", error instanceof Error ? error.message : String(error));
    return handleApiError(error);
  } finally {
    timeout.done();
  }
}
