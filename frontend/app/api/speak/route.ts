// app/api/speak/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Standard-Voice-ID "Rachel"
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

async function synth(text: string, voiceId?: string) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY missing");

  const id = voiceId || DEFAULT_VOICE_ID;
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${id}?optimize_streaming_latency=0`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.3, similarity_boost: 0.8 },
      // output_format: "mp3_44100_128" // optional
    }),
  });

  if (!resp.ok) throw new Error(await resp.text());
  return await resp.arrayBuffer();
}

// ---- GET: für Twilio <Play> und einfache Browser-Tests ----
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get("text") || "";
    const voiceId = searchParams.get("voiceId") || undefined;
    if (!text) return NextResponse.json({ success: false, error: "text required" }, { status: 400 });

    const audio = await synth(text, voiceId);
    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}

// ---- POST: dein bestehender Button-Flow ----
export async function POST(req: Request) {
  try {
    const { text, voiceId } = await req.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ success: false, error: "Text missing" }, { status: 400 });
    }
    const audio = await synth(text, voiceId);
    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("TTS Error:", err);
    return NextResponse.json({ success: false, error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}
