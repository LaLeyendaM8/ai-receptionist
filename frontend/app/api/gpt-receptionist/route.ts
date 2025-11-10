// app/api/gpt-receptionist/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/gpt-receptionist" });
}

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    const system = `
Du bist eine freundliche Rezeptionistin.
Antworte *ausschließlich* als gültiges json-objekt (kleingeschrieben), ohne zusätzlichen Text.
Schema:
{
  "intent": "small_talk | appointment_booking | opening_hours | pricing | transfer | other",
  "reply": "string (max. 1–2 Sätze, natürlich und hilfreich)",
  "meta": { "language": "de", "confidence": number }
}
Wenn Terminwunsch erkannt: intent="appointment_booking".
`;

    // WICHTIG: KEIN response_format hier!
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content:
            `Gib nur ein gültiges json-objekt zurück, ohne Markdown/Erklärung.\n` +
            `Nutzeranfrage: """${text}"""`,
        },
      ],
    });

    const content = resp.choices[0]?.message?.content ?? "{}";

    // Robust parsen
    let data: any;
    try {
      data = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}$/m);
      data = match ? JSON.parse(match[0]) : {
        intent: "other",
        reply: content,
        meta: { language: "de", confidence: 0.5 },
      };
    }

    return NextResponse.json({ success: true, ...data });
  } catch (err: any) {
    console.error("GPT Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
