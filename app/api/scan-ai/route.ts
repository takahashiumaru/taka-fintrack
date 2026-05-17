import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { apiError, isAbortError, readJson, tooManyRequests, withTimeout } from "@/lib/server/http";
import { checkPersistentRateLimit, getClientIp } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxRawTextLength = 12_000;
const maxImageDataLength = 3_200_000;
const maxRequestsPerMinute = 10;
const aiTimeoutMs = 60_000;
const aiMaxTokens = 1400;
const scanModelFallbacks = [
  "full-support",
];
const maxMoneyAmount = 1_000_000_000;
const allowedCategories = new Set([
  "Makanan & Minuman",
  "Belanja Bulanan",
  "Transportasi",
  "Tagihan & Utilitas",
  "Hiburan",
  "Kesehatan",
  "Gaji / Pendapatan",
  "Bonus",
  "Investasi",
]);
const allowedPaymentAccounts = new Set([
  "Cash", "QRIS", "BCA", "BNI", "BRI", "Mandiri", "BSI", "CIMB Niaga", "PermataBank", "Danamon", "Bank Jago", "Krom Bank", "Jenius", "SeaBank", "blu by BCA Digital", "Bank Neo Commerce", "Allo Bank", "Bank Saqu", "LINE Bank", "Superbank", "GoPay", "OVO", "DANA", "ShopeePay", "LinkAja", "AstraPay", "Sakuku", "i.saku", "Kartu Kredit", "Kartu Debit", "Transfer Bank", "Lainnya",
]);

type ScanItem = {
  name: string | null;
  quantity: number | null;
  unit_price: number | null;
  total_price: number | null;
};

type ScanResult = {
  is_transaction: boolean;
  merchant: string | null;
  transaction_date: string | null;
  transaction_time: string | null;
  items: ScanItem[];
  subtotal: number | null;
  discount: number | null;
  tax: number | null;
  grand_total: number | null;
  payment_method: string | null;
  payment_account: string | null;
  currency: string;
  confidence: number;
  raw_text: string | null;
  category_suggestion: string | null;
};

function asNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNullableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function clampMoney(value: unknown) {
  const parsed = asNullableNumber(value);
  if (parsed === null) return null;

  return Math.min(maxMoneyAmount, Math.max(0, Math.round(parsed)));
}

function clampQuantity(value: unknown) {
  const parsed = asNullableNumber(value);
  if (parsed === null) return null;

  return Math.min(10_000, Math.max(0, parsed));
}

function normalizeIsoDate(value: unknown) {
  const text = asNullableString(value);
  if (!text) return null;

  const yyyyMmDd = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyyMmDd) {
    const date = new Date(`${text}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : text;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString().slice(0, 10);
}

function normalizeTime(value: unknown) {
  const text = asNullableString(value);
  if (!text) return null;

  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizeAllowedString(value: unknown, allowed: Set<string>) {
  const text = asNullableString(value);
  if (!text) return null;

  let exact: string | null = null;
  allowed.forEach((candidate) => {
    if (!exact && candidate.toLowerCase() === text.toLowerCase()) exact = candidate;
  });

  return exact;
}

function getScanModels() {
  const models = [process.env.AI_SCAN_MODEL, ...scanModelFallbacks].filter((model): model is string => Boolean(model));

  return Array.from(new Set(models));
}

function buildScanPrompt(rawText: string) {
  const paymentAccounts = Array.from(allowedPaymentAccounts).join(", ");
  const categories = Array.from(allowedCategories).join(", ");
  const ocrText = rawText || "(kosong; gunakan gambar)";

  return `Ekstrak struk transaksi Indonesia dari gambar/OCR. Gunakan gambar sebagai sumber utama, OCR hanya bantuan. Return hanya JSON valid, tanpa markdown.
Aturan: jangan mengarang; uang integer IDR tanpa titik/koma; confidence 0..1; max 40 item; jangan jadikan SUBTOTAL/TOTAL/PPN/PAJAK/DISKON/ADMIN/BAYAR/KEMBALIAN sebagai item. Jika qty jelas hitung unit_price/total_price seperlunya.
payment_account harus salah satu jika bisa: ${paymentAccounts}.
category_suggestion harus salah satu jika bisa: ${categories}. Makanan/supermarket makanan -> Makanan & Minuman; tagihan listrik/air/internet/pulsa/VA/admin/PLN/PDAM -> Tagihan & Utilitas; non-makanan/fashion/aksesoris -> Belanja Bulanan.
Schema wajib: {"is_transaction":boolean,"merchant":string|null,"transaction_date":"YYYY-MM-DD"|null,"transaction_time":"HH:mm"|null,"items":[{"name":string|null,"quantity":number|null,"unit_price":number|null,"total_price":number|null}],"subtotal":number|null,"discount":number|null,"tax":number|null,"grand_total":number|null,"payment_method":string|null,"payment_account":string|null,"currency":"IDR","confidence":number,"raw_text":string|null,"category_suggestion":string|null}
Jika bukan struk, pakai schema yang sama dengan is_transaction false, items [], dan field lain null.
OCR:
"""${ocrText}"""`;
}

function getAiMessageText(value: unknown) {
  const content = (value as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content.map((part) => {
    if (typeof part === "string") return part;
    if (part && typeof part === "object" && "text" in part && typeof part.text === "string") return part.text;
    return "";
  }).join("\n");
}

function extractBalancedJsonObject(text: string) {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }

  return null;
}

function parseAiJson(text: string) {
  const trimmed = text.trim();
  const unfenced = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const fenced: string[] = [];
  const fencePattern = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  let match = fencePattern.exec(trimmed);

  while (match) {
    fenced.push(match[1].trim());
    match = fencePattern.exec(trimmed);
  }

  const candidates = [unfenced, ...fenced, extractBalancedJsonObject(trimmed)].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      return typeof parsed === "string" ? JSON.parse(parsed) : parsed;
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

function normalizeScanResult(value: unknown, rawText: string): ScanResult | null {
  if (!value || typeof value !== "object") return null;

  const input = value as Record<string, unknown>;
  const isTransaction = input.is_transaction === true;
  const items = Array.isArray(input.items)
    ? input.items.slice(0, 40).map((item) => {
        const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
        const quantity = clampQuantity(row.quantity);
        const unitPrice = clampMoney(row.unit_price);
        const totalPrice = clampMoney(row.total_price);

        return {
          name: asNullableString(row.name)?.slice(0, 120) ?? null,
          quantity,
          unit_price: unitPrice,
          total_price: totalPrice ?? (quantity && unitPrice ? clampMoney(quantity * unitPrice) : null),
        };
      }).filter((item) => item.name || item.quantity || item.unit_price || item.total_price)
    : [];
  const confidence = asNullableNumber(input.confidence);
  const currency = asNullableString(input.currency)?.toUpperCase();

  return {
    is_transaction: isTransaction,
    merchant: asNullableString(input.merchant)?.slice(0, 160) ?? null,
    transaction_date: normalizeIsoDate(input.transaction_date),
    transaction_time: normalizeTime(input.transaction_time),
    items: isTransaction ? items : [],
    subtotal: clampMoney(input.subtotal),
    discount: clampMoney(input.discount),
    tax: clampMoney(input.tax),
    grand_total: clampMoney(input.grand_total),
    payment_method: asNullableString(input.payment_method)?.slice(0, 80) ?? null,
    payment_account: normalizeAllowedString(input.payment_account, allowedPaymentAccounts),
    currency: currency === "IDR" ? "IDR" : "IDR",
    confidence: Math.max(0, Math.min(1, confidence ?? 0)),
    raw_text: (asNullableString(input.raw_text) || rawText).slice(0, maxRawTextLength),
    category_suggestion: normalizeAllowedString(input.category_suggestion, allowedCategories),
  };
}

export async function POST(req: NextRequest) {
  const timeout = withTimeout(aiTimeoutMs);

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return apiError("Sesi tidak valid. Login ulang.", 401);

    const rateLimit = await checkPersistentRateLimit(`scan-ai:${user.id}:${getClientIp(req)}`, maxRequestsPerMinute, 60_000);
    if (!rateLimit.ok) return tooManyRequests(rateLimit.resetAt);

    const body = await readJson(req);
    const rawText = typeof body?.rawText === "string" ? body.rawText.trim() : "";
    const imageData = typeof body?.imageData === "string" && body.imageData.startsWith("data:image/") ? body.imageData : "";

    if (!rawText && !imageData) {
      return apiError("rawText atau imageData wajib diisi.");
    }

    if (imageData && imageData.length > maxImageDataLength) {
      return apiError("Gambar terlalu besar. Kompres dulu agar scan tetap cepat.");
    }

    if (rawText.length > maxRawTextLength) {
      return apiError(`rawText terlalu panjang. Maksimal ${maxRawTextLength} karakter.`);
    }

    if (!process.env.AI_API_URL || !process.env.AI_API_KEY) {
      return apiError("Konfigurasi AI belum tersedia.", 503);
    }

    const prompt = buildScanPrompt(rawText);
    const startedAt = Date.now();

    for (const model of getScanModels()) {
      const aiResponse = await fetch(process.env.AI_API_URL, {
        method: "POST",
        signal: timeout.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.AI_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: "Kamu ekstraktor struk. Balas hanya JSON valid yang mengikuti schema user.",
            },
            {
              role: "user",
              content: imageData
                ? [
                    { type: "text", text: prompt },
                    { type: "image_url", image_url: { url: imageData, detail: "low" } },
                  ]
                : prompt,
            },
          ],
          temperature: 0,
          max_tokens: aiMaxTokens,
          stream: false,
        }),
      });

      if (!aiResponse.ok) {
        await aiResponse.text().catch(() => "");
        console.error("AI Scan API upstream error", { model, status: aiResponse.status, durationMs: Date.now() - startedAt });
        continue;
      }

      const aiData = await aiResponse.json().catch(() => null);
      const textResult = getAiMessageText(aiData);
      const jsonParsed = parseAiJson(textResult);

      if (!jsonParsed) {
        console.error("Failed to parse AI scan response as JSON", {
          model,
          durationMs: Date.now() - startedAt,
          sample: textResult.slice(0, 240),
        });
        continue;
      }

      const normalized = normalizeScanResult(jsonParsed, rawText);

      if (!normalized) {
        console.error("AI scan JSON did not match expected shape", { model, durationMs: Date.now() - startedAt });
        continue;
      }

      const response = NextResponse.json(normalized);
      response.headers.set("Server-Timing", `scan-ai;dur=${Date.now() - startedAt}`);
      response.headers.set("X-Scan-AI-Duration", String(Date.now() - startedAt));
      response.headers.set("X-Scan-AI-Model", model);
      return response;
    }

    return apiError("Format hasil AI belum valid. Coba scan ulang.", 502);
  } catch (error) {
    if (isAbortError(error)) {
      return apiError("AI sedang lambat. Coba lagi sebentar.", 504);
    }

    console.error("AI Scan Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  } finally {
    timeout.done();
  }
}
