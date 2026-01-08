// app/api/speak/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Standard-Voice-ID "Rachel"
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

// ✅ Shared secret for internal calls (Twilio <Play> + optional internal POST)
// Set in env: INTERNAL_TTS_TOKEN=...
const INTERNAL_TTS_TOKEN = process.env.INTERNAL_TTS_TOKEN as string;

// simple hard limits against cost-abuse
const MAX_TEXT_CHARS = 500; // MVP: keep it tight

function clampText(t: unknown) {
  const s = (typeof t === "string" ? t : "").trim();
  if (!s) return "";
  return s.length > MAX_TEXT_CHARS ? s.slice(0, MAX_TEXT_CHARS) : s;
}

function isAuthorized(req: Request) {
  // In dev: keep it usable
  if (process.env.NODE_ENV !== "production") return true;

  if (!INTERNAL_TTS_TOKEN) return false;

  // Prefer query token (works for Twilio <Play>)
  const url = new URL(req.url);
  const qToken = url.searchParams.get("token") ?? "";

  // Optional header token (works for server-to-server POST)
  const hToken = req.headers.get("x-internal-token") ?? "";

  return qToken === INTERNAL_TTS_TOKEN || hToken === INTERNAL_TTS_TOKEN;
}

async function synth(text: string, voiceId?: string) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY missing");

  // ✅ MVP: ignore voiceId in prod to prevent people from choosing expensive/unknown voices
  const id =
    process.env.NODE_ENV === "production"
      ? DEFAULT_VOICE_ID
      : voiceId || DEFAULT_VOICE_ID;

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${id}?optimize_streaming_latency=0`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.3, similarity_boost: 0.8 },
    }),
  });

  if (!resp.ok) throw new Error(await resp.text());
  return await resp.arrayBuffer();
}

// ---- GET: Twilio <Play> ----
export async function GET(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return new Response("Forbidden", { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const text = clampText(searchParams.get("text"));
    const voiceId = searchParams.get("voiceId") || undefined;

    if (!text) {
      return NextResponse.json(
        { success: false, error: "text required" },
        { status: 400 }
      );
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
    return NextResponse.json(
      { success: false, error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

// ---- POST: internal server-to-server (optional) ----
export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return new Response("Forbidden", { status: 403 });
    }

    const body = await req.json();
    const text = clampText(body?.text);
    const voiceId = body?.voiceId || undefined;

    if (!text) {
      return NextResponse.json(
        { success: false, error: "Text missing" },
        { status: 400 }
      );
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
    return NextResponse.json(
      { success: false, error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
