export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { twiml as TwiML } from "twilio";

// Twilio sendet application/x-www-form-urlencoded → Text lesen & parsen
async function parseForm(req: Request) {
  const raw = await req.text();
  return Object.fromEntries(new URLSearchParams(raw));
}

export async function GET() {
  // Healthcheck
  return NextResponse.json({ ok: true, message: "AI Receptionist – /api/call/handle alive" });
}

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    const params = Object.fromEntries(new URLSearchParams(raw));
    const userText = params.SpeechResult || params.TranscriptionText || params.Digits || "";

    const BASE = process.env.PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
    const vr = new TwiML.VoiceResponse();

    if (!userText) {
      // Nichts verstanden → Rückfrage + noch ein Gather
      const g = vr.gather({
        input: ["speech"],
        language: "de-DE",
        action: `${BASE}/api/call/handle`,
        method: "POST",
        speechTimeout: "auto",
        timeout: 6,
        actionOnEmptyResult: true,
      });
      g.say({ voice: "alice", language: "de-DE" }, "Entschuldigung, ich habe nichts gehört. Was kann ich für Sie tun?");
      // Fallback, falls auch dieses Gather leer bleibt:
      vr.say({ voice: "alice", language: "de-DE" }, "Okay, dann wünsche ich Ihnen einen schönen Tag. Auf Wiederhören.");
      vr.hangup();
      return new Response(vr.toString(), { headers: { "Content-Type": "text/xml" } });
    }

    // --- GPT mit hartem 5s Timeout ---
    let reply = "Alles klar. Ich habe das so notiert.";
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 5000);
      const r = await fetch(`${BASE}/api/gpt-receptionist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: userText }),
        signal: ctrl.signal,
      });
      clearTimeout(tid);
      if (r.ok) {
        const j = await r.json();
        reply = j?.reply || reply;
      } else {
        console.warn("[HANDLE] GPT status:", r.status);
      }
    } catch (e: any) {
      console.warn("[HANDLE] GPT timeout/error:", e?.name || e);
    }

    // --- Nur EINES senden: Play ODER Say ---
    const TTS_ENABLED = process.env.ENABLE_TTS !== "false";
    if (TTS_ENABLED) {
      const u = new URL("/api/speak", BASE);
      u.searchParams.set("text", reply);
      vr.play(u.toString());
    } else {
      vr.say({ voice: "alice", language: "de-DE" }, reply);
    }

    // --- Nächste Runde: neues Gather für Follow-up ---
    const g2 = vr.gather({
      input: ["speech"],
      language: "de-DE",
      action: `${BASE}/api/call/handle`, // selbe Route → nächster Turn
      method: "POST",
      speechTimeout: "auto",
      timeout: 6,
      actionOnEmptyResult: true,
    });
    g2.say({ voice: "alice", language: "de-DE" }, "Kann ich sonst noch etwas für Sie tun?");

    // Fallback wenn keine Antwort mehr kommt
    vr.say({ voice: "alice", language: "de-DE" }, "Alles klar. Vielen Dank für Ihren Anruf. Auf Wiederhören.");
    vr.hangup();

    return new Response(vr.toString(), { headers: { "Content-Type": "text/xml" } });
  } catch (e: any) {
    console.error("[HANDLE] fatal:", e);
    const vr = new TwiML.VoiceResponse();
    vr.say({ voice: "alice", language: "de-DE" }, "Es ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.");
    return new Response(vr.toString(), { headers: { "Content-Type": "text/xml" } });
  }
}





