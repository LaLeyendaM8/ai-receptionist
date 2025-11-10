import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const audio = form.get("file") as File | null;
    if (!audio) {
      return NextResponse.json({ success: false, error: "No audio file provided" }, { status: 400 });
    }

    // 1️⃣ Schritt – Transkription (Whisper)
    const transcription = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file: audio,
      language: "de",
    });

    const text = transcription.text.trim();

    // 2️⃣ Schritt – GPT Receptionist Logik
    const systemPrompt = `
Du bist eine freundliche Rezeptionistin.
Antworte *ausschließlich* als gültiges json-objekt, ohne zusätzlichen Text.
Schema:
{
  "intent": "small_talk | appointment_booking | opening_hours | pricing | transfer | other",
  "reply": "string (max. 1–2 Sätze, natürlich und hilfreich)",
  "meta": { "language": "de", "confidence": number }
}
Wenn Terminwunsch erkannt: intent="appointment_booking".
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Gib nur ein gültiges json-objekt zurück.\nKundenaussage: """${text}"""`,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    let gpt: any;
    try {
      gpt = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}$/m);
      gpt = match ? JSON.parse(match[0]) : { intent: "other", reply: content };
    }

    // 3️⃣ Kombinierte Antwort
    return NextResponse.json({
      success: true,
      transcript: text,
      ...gpt,
    });
  } catch (err: any) {
    console.error("Voice Intent Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
