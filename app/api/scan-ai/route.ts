import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { apiError, isAbortError, readJson, tooManyRequests, withTimeout } from "@/lib/server/http";
import { checkPersistentRateLimit, getClientIp } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxRawTextLength = 12_000;
const maxImageDataLength = 8_000_000;
const maxRequestsPerMinute = 10;
const aiTimeoutMs = 30_000;
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
      return apiError("Gambar terlalu besar. Maksimal sekitar 8MB.");
    }

    if (rawText.length > maxRawTextLength) {
      return apiError(`rawText terlalu panjang. Maksimal ${maxRawTextLength} karakter.`);
    }

    if (!process.env.AI_API_URL || !process.env.AI_API_KEY) {
      return apiError("Konfigurasi AI belum tersedia.", 503);
    }

    const prompt = `Kamu adalah sistem ekstraksi data struk transaksi.

Analisis teks hasil OCR dan/atau gambar struk berikut. Jika gambar tersedia, prioritaskan gambar karena OCR bisa salah atau kosong. Tentukan apakah ini struk transaksi atau bukan.

Jika ini struk transaksi, ambil data penting seperti nama toko, tanggal, waktu, daftar barang, jumlah, harga, subtotal, diskon, pajak, total akhir, metode pembayaran, dan akun/dompet pembayaran yang dipakai.

Jika data tidak tersedia, isi dengan null. Jangan mengarang data. Harga harus berupa angka integer tanpa titik atau koma. Kembalikan hanya JSON valid tanpa penjelasan tambahan.

Format output wajib:

{
  "is_transaction": true,
  "merchant": null,
  "transaction_date": null,
  "transaction_time": null,
  "items": [
    {
      "name": null,
      "quantity": null,
      "unit_price": null,
      "total_price": null
    }
  ],
  "subtotal": null,
  "discount": null,
  "tax": null,
  "grand_total": null,
  "payment_method": null,
  "payment_account": null,
  "currency": "IDR",
  "confidence": 0,
  "raw_text": null,
  "category_suggestion": null
}

payment_account wajib dinormalisasi jika bisa ke salah satu: "Cash", "QRIS", "BCA", "BNI", "BRI", "Mandiri", "BSI", "CIMB Niaga", "PermataBank", "Danamon", "Bank Jago", "Krom Bank", "Jenius", "SeaBank", "blu by BCA Digital", "Bank Neo Commerce", "Allo Bank", "Bank Saqu", "LINE Bank", "Superbank", "GoPay", "OVO", "DANA", "ShopeePay", "LinkAja", "AstraPay", "Sakuku", "i.saku", "Kartu Kredit", "Kartu Debit", "Transfer Bank", "Lainnya".
Contoh: tunai/cash -> "Cash", qris/qr -> "QRIS", BCA -> "BCA", BNI -> "BNI", BRI -> "BRI", Mandiri/Livin -> "Mandiri", BSI -> "BSI", Krom/Krom Bank -> "Krom Bank", ShopeePay/SPay -> "ShopeePay", debit tanpa bank jelas -> "Kartu Debit", transfer bank tanpa nama bank jelas -> "Transfer Bank".

Kategori wajib dipilih dari salah satu nama ini jika memungkinkan: "Makanan & Minuman", "Belanja Bulanan", "Transportasi", "Tagihan & Utilitas", "Hiburan", "Kesehatan", "Gaji / Pendapatan", "Bonus", "Investasi".
Jika merchant/item terlihat seperti makanan/minuman/warung/resto/cafe/supermarket belanja makanan, isi category_suggestion "Makanan & Minuman".
Jika pembayaran tagihan listrik/air/internet/pulsa/VA/admin/PLN/PDAM, isi "Tagihan & Utilitas".
Jika aksesoris/fashion/non-makanan, isi "Belanja Bulanan".

Jika bukan struk transaksi, output wajib:

{
  "is_transaction": false,
  "merchant": null,
  "transaction_date": null,
  "transaction_time": null,
  "items": [],
  "subtotal": null,
  "discount": null,
  "tax": null,
  "grand_total": null,
  "payment_method": null,
  "payment_account": null,
  "currency": "IDR",
  "confidence": 0,
  "raw_text": null,
  "category_suggestion": null
}

Teks OCR:
"""
${rawText || "(OCR kosong/tidak terbaca; gunakan gambar jika tersedia)"}
"""`;

    const aiResponse = await fetch(process.env.AI_API_URL, {
      method: "POST",
      signal: timeout.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "full-support",
        messages: [
          {
            role: "user",
            content: imageData
              ? [
                  { type: "text", text: prompt },
                  { type: "image_url", image_url: { url: imageData } },
                ]
              : prompt,
          },
        ],
        stream: false,
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI Scan API upstream error", { status: aiResponse.status });
      return apiError("AI scan sedang bermasalah. Coba lagi sebentar.", 502);
    }

    const aiData = await aiResponse.json();
    const textResult = aiData.choices?.[0]?.message?.content || "";
    const cleanedText = textResult.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    try {
      const jsonParsed = JSON.parse(cleanedText);
      const normalized = normalizeScanResult(jsonParsed, rawText);

      if (!normalized) return apiError("Format hasil AI belum valid. Coba scan ulang.", 502);

      return NextResponse.json(normalized);
    } catch {
      console.error("Failed to parse AI scan response as JSON");
      return apiError("Format hasil AI belum valid. Coba scan ulang.", 502);
    }
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
