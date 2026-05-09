import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { apiError, readJson, tooManyRequests } from "@/lib/server/http";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxRawTextLength = 12_000;
const maxRequestsPerMinute = 10;

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return apiError("Sesi tidak valid. Login ulang.", 401);

    const rateLimit = checkRateLimit(`scan-ai:${user.id}:${getClientIp(req)}`, maxRequestsPerMinute, 60_000);
    if (!rateLimit.ok) return tooManyRequests(rateLimit.resetAt);

    const body = await readJson(req);
    const rawText = typeof body?.rawText === "string" ? body.rawText.trim() : "";

    if (!rawText) {
      return apiError("rawText wajib diisi.");
    }

    if (rawText.length > maxRawTextLength) {
      return apiError(`rawText terlalu panjang. Maksimal ${maxRawTextLength} karakter.`);
    }

    if (!process.env.AI_API_URL || !process.env.AI_API_KEY) {
      return apiError("Konfigurasi AI belum tersedia.", 503);
    }

    const prompt = `Kamu adalah sistem ekstraksi data struk transaksi.

Analisis teks hasil OCR berikut dan tentukan apakah ini struk transaksi atau bukan.

Jika ini struk transaksi, ambil data penting seperti nama toko, tanggal, waktu, daftar barang, jumlah, harga, subtotal, diskon, pajak, total akhir, dan metode pembayaran.

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
  "currency": "IDR",
  "confidence": 0,
  "raw_text": null
}

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
  "currency": "IDR",
  "confidence": 0,
  "raw_text": null
}

Teks OCR:
"""
${rawText}
"""`;

    const aiResponse = await fetch(process.env.AI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "full-support",
        messages: [
          { role: "user", content: prompt },
        ],
        stream: false,
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI Scan API Error:", await aiResponse.text());
      return NextResponse.json({ error: "API Response Not OK" }, { status: 500 });
    }

    const aiData = await aiResponse.json();
    const textResult = aiData.choices?.[0]?.message?.content || "";
    const cleanedText = textResult.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    try {
      const jsonParsed = JSON.parse(cleanedText);
      return NextResponse.json(jsonParsed);
    } catch {
      console.error("Failed to parse AI response as JSON:", cleanedText);
      return NextResponse.json({ error: "Invalid JSON from AI" }, { status: 500 });
    }
  } catch (error) {
    console.error("AI Scan Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
