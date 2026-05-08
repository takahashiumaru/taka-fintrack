import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!messages) {
      return NextResponse.json({ error: "messages are required" }, { status: 400 });
    }

    const aiResponse = await fetch(process.env.AI_API_URL || '', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.AI_API_KEY}`
      },
      body: JSON.stringify({
        model: "full-support",
        messages,
        stream: true
      })
    });

    if (!aiResponse.ok) {
      console.error("AI Chat API Error:", await aiResponse.text());
      return NextResponse.json({ error: "API Response Not OK" }, { status: 500 });
    }

    // Return the stream directly to the client
    return new Response(aiResponse.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error("AI Chat Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
