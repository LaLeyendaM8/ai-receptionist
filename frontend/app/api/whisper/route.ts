// app/api/whisper/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs"; // Whisper braucht Node (nicht edge)
export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function GET() {
  // Healthcheck statt 405
  return NextResponse.json({
    ok: true,
    message: "Whisper endpoint is ready. POST multipart/form-data with field 'file'.",
  });
}

// Optional: CORS/Preflight (hilfreich für lokale Tests im Browser)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Expected multipart/form-data with field 'file'." },
        { status: 400 }
      );
    }

    const form = await req.formData();
    const audio = form.get("file") as File | null;
    if (!audio) {
      return NextResponse.json({ error: "No file provided under field 'file'." }, { status: 400 });
    }

    const transcription = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file: audio, // Next.js File wird unterstützt
      // language: "de", // optional erzwingen
      // response_format: "json", // default
      // temperature: 0 // optional
    });

    const text = transcription.text?.trim() || "";

    return NextResponse.json({
      success: true,
      text,
      structured: {
        timestamp: new Date().toISOString(),
        langHint: "auto", // oder "de" wenn language gesetzt
        rawText: text,
      },
    });
  } catch (err: any) {
    console.error("Whisper error:", err);
    return NextResponse.json(
      { error: "Transcription failed", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
