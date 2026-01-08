export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getBaseUrl } from "@/lib/getBaseUrl";
import { NextResponse } from "next/server";
import { twiml as TwiML, validateRequest } from "twilio";
import { createServiceClient } from "@/lib/supabaseClients";
import {
  ensureConversationState,
  incrementCounter,
  resetCounters,
} from "@/lib/conversation-state";
import { runGptReceptionistFlow } from "@/lib/callflow/gpt-receptionist";

// ---------------------------------------------------------------------------
// Konfiguration / Helper
// ---------------------------------------------------------------------------

const TTS_ENABLED = process.env.ENABLE_TTS !== "false";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN as string;

function verifyTwilioSignature(req: Request, params: Record<string, string>) {
  const signature = req.headers.get("x-twilio-signature") ?? "";
  if (!signature) return false;

  // Wichtig: gleiche URL, die Twilio signiert (dein base + path + query)
  const base = getBaseUrl(req);
  const u = new URL(req.url);
  const url = `${base}${u.pathname}${u.search}`;

  return validateRequest(TWILIO_AUTH_TOKEN, signature, url, params);
}

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
function sayWithTTS(target: any, text: string, base?: string) {
  if (!text) return;

  if (!base || !TTS_ENABLED) {
    target.say({ voice: "alice", language: "de-DE" }, text);
    return;
  }

  const u = new URL("/api/speak", base);
  u.searchParams.set("text", text);
  const tok = process.env.INTERNAL_TTS_TOKEN;
  if (tok) u.searchParams.set("token", tok);
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
  supabase: ReturnType<typeof createServiceClient>,
  params: Record<string, string>
): Promise<ClientProfile | null> {
  try {
    const calledNumber = params.To || params.Called || params.ToFormatted || "";

    if (!calledNumber) {
      console.warn("[HANDLE] no calledNumber in Twilio params");
      return null;
    }

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
      console.warn("[HANDLE] no client for twilio_number", calledNumber);
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
  const base = getBaseUrl(req);

  // ✅ EINMAL pro Request
  const supabase = createServiceClient();

  try {
    const params = await parseForm(req);

    if (process.env.NODE_ENV === "production") {
      if (!TWILIO_AUTH_TOKEN) {
        // fail-closed in prod
        return new Response("Server misconfigured", { status: 500 });
      }

      const valid = verifyTwilioSignature(req, params);
      if (!valid) {
        return new Response("Invalid Twilio signature", { status: 403 });
      }
    }

    const userText =
      params.SpeechResult || params.TranscriptionText || params.Digits || "";
    const callSid = params.CallSid as string | undefined;
    const sessionId = String(callSid || "");

    const fromNumber = params.From || "";
    const toNumber = params.To || params.Called || params.ToFormatted || "";

    // Multi-Tenant: Client anhand der angerufenen Nummer laden
    const clientProfile = await loadClientProfile(supabase, params);

    // Conversation-State (best-effort)
    let conv: any = null;
    if (clientProfile?.id && sessionId) {
      try {
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
    const isFirstTurn =
      !params.SpeechResult && !params.TranscriptionText && !params.Digits;

    if (isFirstTurn) {
      const g = vr.gather({
        input: ["speech"],
        language: "de-DE",
        action: `${base}/api/call/handle`,
        method: "POST",
        speechTimeout: "auto",
        timeout: 6,
        actionOnEmptyResult: true,
      });

      sayWithTTS(g, buildGreeting(clientProfile), base);
      return new Response(vr.toString(), {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Kein UserText -> retry logic
    if (!userText) {
      // CSH: noSpeechCount erhöhen
      let count = 1;
      try {
        if (conv && clientProfile?.id && sessionId) {
          count = await incrementCounter({
            supabase,
            conv,
            key: "noSpeechCount",
          });
        }
      } catch {}

      if (count >= 3) {
        sayWithTTS(
          vr,
          "Ich konnte leider nichts hören. Bitte rufen Sie später nochmal an. Auf Wiederhören.",
          base
        );
        vr.hangup();
        return new Response(vr.toString(), {
          headers: { "Content-Type": "text/xml" },
        });
      }

      const g = vr.gather({
        input: ["speech"],
        language: "de-DE",
        action: `${base}/api/call/handle`,
        method: "POST",
        speechTimeout: "auto",
        timeout: 6,
        actionOnEmptyResult: true,
      });

      const msg =
        count === 1
          ? "Entschuldigung, ich habe nichts gehört. Können Sie das bitte nochmal sagen?"
          : "Ich höre Sie leider nicht. Bitte sprechen Sie einmal deutlich – was kann ich für Sie tun?";

      sayWithTTS(g, msg, base);
      return new Response(vr.toString(), {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Speech da -> counters reset (best-effort)
    try {
      if (conv) {
        await resetCounters({ supabase, conv });
      }
    } catch {}

    // ---------------------------------------------------------------------
    // GPT-Receptionist Helper aufrufen (ohne fetch)
    // ---------------------------------------------------------------------

    let reply = "Alles klar. Ich habe das so notiert.";
    let endCall = false;

    try {
      const out = await runGptReceptionistFlow({
        // ✅ supabase durchreichen (dein helper muss das akzeptieren;
        // falls er aktuell selbst createServiceClient() macht, ist das trotzdem ok)
        supabase,
        text: userText,
        fromNumber,
        toNumber,
        clientId: clientProfile?.id ?? null,
        sessionId,
      } as any);

      if (out?.success) {
        reply = out.reply || reply;
        endCall = Boolean(out.end_call);
      } else {
        console.warn("[HANDLE] receptionist failed:", out?.error, out?.details);
      }
    } catch (e: any) {
      console.warn("[HANDLE] receptionist error:", e?.name || e);
    }

    // Antwort ausspielen
    sayWithTTS(vr, reply, base);

    if (endCall) {
      vr.hangup();
      return new Response(vr.toString(), {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // still gather, NO extra sentence
    vr.gather({
      input: ["speech"],
      language: "de-DE",
      action: `${base}/api/call/handle`,
      method: "POST",
      speechTimeout: "auto",
      timeout: 6,
      actionOnEmptyResult: true,
    });

    return new Response(vr.toString(), {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (e: any) {
    console.error("[HANDLE] fatal:", e);
    const vr = new TwiML.VoiceResponse();
    sayWithTTS(
      vr,
      "Es ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.",
      base
    );
    return new Response(vr.toString(), {
      headers: { "Content-Type": "text/xml" },
    });
  }
}
