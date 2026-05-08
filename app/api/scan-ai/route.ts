import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { rawText } = await req.json();

    if (!rawText) {
      return NextResponse.json({ error: "rawText is required" }, { status: 400 });
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

    const aiResponse = await fetch(process.env.AI_API_URL || '', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.AI_API_KEY}`
      },
      body: JSON.stringify({
        model: "full-support",
        messages: [
          { role: "user", content: prompt }
        ],
        stream: false
      })
    });

    if (!aiResponse.ok) {
      console.error("AI Scan API Error:", await aiResponse.text());
      return NextResponse.json({ error: "API Response Not OK" }, { status: 500 });
    }

    const aiData = await aiResponse.json();
    const textResult = aiData.choices?.[0]?.message?.content || "";
    
    // Clean up markdown block if present
    const cleanedText = textResult.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    
    try {
      const jsonParsed = JSON.parse(cleanedText);
      return NextResponse.json(jsonParsed);
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", cleanedText);
      return NextResponse.json({ error: "Invalid JSON from AI" }, { status: 500 });
    }
  } catch (error) {
    console.error("AI Scan Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
