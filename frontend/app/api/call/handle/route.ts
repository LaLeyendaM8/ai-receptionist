export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { twiml as TwiML } from "twilio";
import { createServiceClient } from "@/lib/supabaseClients";
import { ensureConversationState, incrementCounter, resetCounters } from "@/lib/conversation-state";

// ---------------------------------------------------------------------------
// Konfiguration / Helper
// ---------------------------------------------------------------------------

const BASE =
  process.env.PUBLIC_BASE_URL;

const TTS_ENABLED = process.env.ENABLE_TTS !== "false";

type ClientProfile = {
  id: string;
  name: string | null;
  twilio_number?: string | null;
};

// Twilio sendet application/x-www-form-urlencoded → Text lesen & parsen
async function parseForm(req: Request): Promise<Record<string, string>> {
  const raw = await req.text();
  return Object.fromEntries(new URLSearchParams(raw));
}

/**
 * TTS über ElevenLabs ( /api/speak ) mit Fallback auf Twilio „alice“.
 * target kann VoiceResponse oder Gather sein.
 */
function sayWithTTS(target: any, text: string) {
  if (!text) return;

  if (!BASE || !TTS_ENABLED) {
    target.say({ voice: "alice", language: "de-DE" }, text);
    return;
  }

  const u = new URL("/api/speak", BASE);
  u.searchParams.set("text", text);
  target.play(u.toString());
}

/**
 * Begrüßung aus Client-Profil.
 */
function buildGreeting(client: ClientProfile | null) {
  const companyName = client?.name?.trim();
  if (companyName) {
    return `Willkommen bei ${companyName}. Was kann ich für Sie tun?`;
  }
  return "Willkommen bei ReceptaAI. Was kann ich für Sie tun?";
}

/**
 * Multi-Tenant-Zuordnung:
 * angerufene Twilio-Nummer → Client-Datensatz aus Supabase.
 *
 * Voraussetzung in DB:
 *  - Tabelle "clients"
 *  - Spalte "twilio_number" (String)
 *  - Inhalt = exakt die Nummer, die Twilio in params.To schickt (E.164, z.B. +4930...)
 */
async function loadClientProfile(
  params: Record<string, string>
): Promise<ClientProfile | null> {
  try {
    const calledNumber =
      params.To || params.Called || params.ToFormatted || "";

    if (!calledNumber) {
      console.warn("[HANDLE] no calledNumber in Twilio params");
      return null;
    }

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("clients")
      .select("id, name, twilio_number")
      .eq("twilio_number", calledNumber)
      .maybeSingle();

    if (error) {
      console.error("[HANDLE] loadClientProfile error:", error);
      return null;
    }

    if (!data) {
      console.warn(
        "[HANDLE] no client for twilio_number",
        calledNumber
      );
      return null;
    }

    return data as ClientProfile;
  } catch (e) {
    console.error("[HANDLE] loadClientProfile fatal:", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function GET() {
  // Healthcheck
  return NextResponse.json({
    ok: true,
    message: "AI Receptionist – /api/call/handle alive",
  });
}

export async function POST(req: Request) {
  try {
    const params = await parseForm(req);
    const userText =
      params.SpeechResult || params.TranscriptionText || params.Digits || "";
    const callSid = params.CallSid as String | undefined;
    const fromNumber = params.From || "";
    const toNumber =
      params.To || params.Called || params.ToFormatted || "";

    // Multi-Tenant: Client anhand der angerufenen Nummer laden
    const clientProfile = await loadClientProfile(params);
const sessionId = String(callSid || "");
let conv = null as any;

if (clientProfile?.id && sessionId) {
  try {
    const supabase = createServiceClient();
    conv = await ensureConversationState({
      supabase,
      clientId: clientProfile.id,
      sessionId,
      channel: "phone",
    });
  } catch (e) {
    console.warn("[HANDLE] ensureConversationState failed", e);
  }
}

    const vr = new TwiML.VoiceResponse();

// Wenn das der erste Turn ist (kein SpeechResult) -> Begrüßung + Gather
const isFirstTurn = !params.SpeechResult && !params.TranscriptionText && !params.Digits;

if (isFirstTurn) {
  const g = vr.gather({
    input: ["speech"],
    language: "de-DE",
    action: `${BASE}/api/call/handle`,
    method: "POST",
    speechTimeout: "auto",
    timeout: 6,
    actionOnEmptyResult: true,
  });

  sayWithTTS(g, buildGreeting(clientProfile));
  return new Response(vr.toString(), { headers: { "Content-Type": "text/xml" } });
}


if (!userText) {
  // CSH: noSpeechCount erhöhen
  let count = 1;
  try {
    if (conv && clientProfile?.id && sessionId) {
      const supabase = createServiceClient();
      count = await incrementCounter({ supabase, conv, key: "noSpeechCount" });
    }
  } catch {}

  if (count >= 3) {
    sayWithTTS(vr, "Ich konnte leider nichts hören. Bitte rufen Sie später nochmal an. Auf Wiederhören.");
    vr.hangup();
    return new Response(vr.toString(), { headers: { "Content-Type": "text/xml" } });
  }

  const g = vr.gather({
    input: ["speech"],
    language: "de-DE",
    action: `${BASE}/api/call/handle`,
    method: "POST",
    speechTimeout: "auto",
    timeout: 6,
    actionOnEmptyResult: true,
  });

  const msg =
    count === 1
      ? "Entschuldigung, ich habe nichts gehört. Können Sie das bitte nochmal sagen?"
      : "Ich höre Sie leider nicht. Bitte sprechen Sie einmal deutlich – was kann ich für Sie tun?";

  sayWithTTS(g, msg);
  return new Response(vr.toString(), { headers: { "Content-Type": "text/xml" } });
}
try {
  if (conv) {
    const supabase = createServiceClient();
    await resetCounters({ supabase, conv });
  }
} catch {}


    // ---------------------------------------------------------------------
    // GPT-Brain aufrufen (mit Client-Kontext)
    // ---------------------------------------------------------------------

    let reply = "Alles klar. Ich habe das so notiert.";
    let endCall = false;
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 5000);

      const r = await fetch(`${BASE}/api/gpt-receptionist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: userText,
          fromNumber: fromNumber,
          toNumber: toNumber,
          clientId: clientProfile?.id ?? null,
          sessionId,
        }),
        signal: ctrl.signal,
      });

      clearTimeout(tid);


if (r.ok) {
  const j = await r.json();
  reply = j?.reply || reply;
  endCall = Boolean(j?.end_call);
}
 else {
        console.warn("[HANDLE] GPT status:", r.status);
      }
    } catch (e: any) {
      console.warn("[HANDLE] GPT timeout/error:", e?.name || e);
    }

// Antwort ausspielen
sayWithTTS(vr, reply);

if (endCall) {
  vr.hangup();
  return new Response(vr.toString(), { headers: { "Content-Type": "text/xml" } });
}


// still gather, NO extra sentence
 vr.gather({
  input: ["speech"],
  language: "de-DE",
  action: `${BASE}/api/call/handle`,
  method: "POST",
  speechTimeout: "auto",
  timeout: 6,
  actionOnEmptyResult: true,
});

return new Response(vr.toString(), { headers: { "Content-Type": "text/xml" } });




  } catch (e: any) {
    console.error("[HANDLE] fatal:", e);
    const vr = new TwiML.VoiceResponse();
    sayWithTTS(
      vr,
      "Es ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut."
    );
    return new Response(vr.toString(), {
      headers: { "Content-Type": "text/xml" },
    });
  }
}
