// app/api/speak/route.ts
import { NextResponse } from "next/server";
import { verifyTtsToken } from "@/lib/callflow/ttsToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_VOICE_ID = "zKHQdbB8oaQ7roNTiDTK";
const MAX_TEXT_CHARS = 500;

function clampText(t: unknown) {
  const s = (typeof t === "string" ? t : "").trim();
  if (!s) return "";
  return s.length > MAX_TEXT_CHARS ? s.slice(0, MAX_TEXT_CHARS) : s;
}

function normalizeForSpeech(input: string) {
  return input
    // Bereiche wie 09:00–18:00 / 09:00-18:00
    .replace(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/g, (_, h1, m1, h2, m2) => {
      const left =
        m1 === "00" ? `${parseInt(h1, 10)} Uhr` : `${parseInt(h1, 10)} Uhr ${parseInt(m1, 10)}`;
      const right =
        m2 === "00" ? `${parseInt(h2, 10)} Uhr` : `${parseInt(h2, 10)} Uhr ${parseInt(m2, 10)}`;
      return `${left} bis ${right}`;
    })

    // Geldbeträge wie 30.00 € / 30,00 €
    .replace(/(\d+)[\.,]00\s*€/g, "$1 Euro")
    .replace(/(\d+)\s*€/g, "$1 Euro")

    // Uhrzeiten wie 18:00
    .replace(/\b(\d{1,2}):00\b/g, (_, h) => `${parseInt(h, 10)} Uhr`)

    // Uhrzeiten wie 18:30
    .replace(/\b(\d{1,2}):(\d{2})\b/g, (_, h, m) => {
      return `${parseInt(h, 10)} Uhr ${parseInt(m, 10)}`;
    })

    // einzelnes Euro-Zeichen als fallback
    .replace(/€/g, "Euro");
}

async function synth(text: string, voiceId?: string) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY missing");

  const id =
    process.env.NODE_ENV === "production"
      ? DEFAULT_VOICE_ID
      : voiceId || DEFAULT_VOICE_ID;

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${id}?optimize_streaming_latency=2`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_turbo_v2_5",
      voice_settings: { stability: 0.25, similarity_boost: 0.85 , style: 0.3, use_speaker_boost: true },
    }),
  });

  if (!resp.ok) throw new Error(await resp.text());
  return await resp.arrayBuffer();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    let text = "";

    if (process.env.NODE_ENV === "production") {
      const token = searchParams.get("token");
      if (!token) {
        return new Response("Forbidden: missing token", {
          status: 403,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }

      const verifiedText = verifyTtsToken(token);
      if (!verifiedText) {
        return new Response("Forbidden: invalid token", {
          status: 403,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }

      text = normalizeForSpeech(clampText(verifiedText));
    } else {
      text = normalizeForSpeech(clampText(searchParams.get("text")));
    }

    const voiceId = searchParams.get("voiceId") || undefined;

    if (!text) {
      return new Response("Bad Request: text required", {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
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
    return new Response(`TTS Error: ${err?.message ?? "Unknown error"}`, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

export async function POST(req: Request) {
  try {
    if (process.env.NODE_ENV === "production") {
      return new Response("Forbidden", {
        status: 403,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const body = await req.json();
    const text = normalizeForSpeech(clampText(body?.text));
    const voiceId = body?.voiceId || undefined;

    if (!text) {
      return new Response("Bad Request: Text missing", {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
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
    return new Response(`TTS Error: ${err?.message ?? "Unknown error"}`, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
