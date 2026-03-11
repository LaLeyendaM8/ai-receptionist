export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getBaseUrl } from "@/lib/getBaseUrl";
import { NextResponse } from "next/server";
import { createTtsToken } from "@/lib/callflow/ttsToken";
import { twiml as TwiML, validateRequest } from "twilio";
import { createServiceClient } from "@/lib/supabaseClients";
import {
  ensureConversationState,
  incrementCounter,
  resetCounters,
  patchConversationState,
} from "@/lib/callflow/conversation-state";
import { runGptReceptionistFlow } from "@/lib/callflow/gpt-receptionist";

// ---------------------------------------------------------------------------
// Konfiguration / Helper
// ---------------------------------------------------------------------------

const TTS_ENABLED = process.env.ENABLE_TTS !== "false";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN as string;

function verifyTwilioSignature(req: Request, params: Record<string, string>) {
  const signature = req.headers.get("x-twilio-signature") ?? "";
  if (!signature) return false;

  const base = getBaseUrl(req);
  const u = new URL(req.url);
  const url = `${base}${u.pathname}${u.search}`;

  return validateRequest(TWILIO_AUTH_TOKEN, signature, url, params);
}

type ClientProfile = {
  id: string;
  name: string | null;
  twilio_number?: string | null;
  phone?: string | null;
};

async function parseForm(req: Request): Promise<Record<string, string>> {
  const raw = await req.text();
  return Object.fromEntries(new URLSearchParams(raw));
}

function sayWithTTS(target: any, text: string, base?: string) {
  if (!text) return;

  if (!base || !TTS_ENABLED) {
    target.say({ voice: "alice", language: "de-DE" }, text);
    return;
  }

  const token = createTtsToken(text);

  const u = new URL("/api/speak", base);
  u.searchParams.set("token", token);

  target.play(u.toString());
}

function buildGreeting(client: ClientProfile | null) {
  const companyName = client?.name?.trim();
  if (companyName) {
    return `Willkommen bei ${companyName}. Ich bin die virtuelle Rezeptionistin. Möchten Sie einen Termin buchen oder haben Sie eine kurze Frage – zum Beispiel zu Öffnungszeiten oder Preisen?`;
  }
  return "Willkommen bei ReceptaAI. Ich bin die virtuelle Rezeptionistin. Möchten Sie einen Termin buchen oder haben Sie eine kurze Frage – zum Beispiel zu Öffnungszeiten oder Preisen?";
}

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
      .select("id, name, twilio_number, phone")
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

function buildTransferTwiml(args: {
  vr: InstanceType<typeof TwiML.VoiceResponse>;
  base: string;
  targetNumber: string;
  callerId?: string | null;
}) {
  const { vr, base, targetNumber, callerId } = args;

  sayWithTTS(vr, "Alles klar. Ich verbinde Sie jetzt mit einem Mitarbeiter.", base);

  const dial = vr.dial({
    callerId: callerId ?? undefined,
    timeout: 20,
    answerOnBridge: true,
    action: `${base}/api/call/handle?stage=transfer-fallback`,
    method: "POST",
  });

  dial.number(targetNumber);
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "AI Receptionist – /api/call/handle alive",
  });
}

export async function POST(req: Request) {
  const base = getBaseUrl(req);
  const supabase = createServiceClient();

  try {
    const params = await parseForm(req);

    if (process.env.NODE_ENV === "production") {
      if (!TWILIO_AUTH_TOKEN) {
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

    const clientProfile = await loadClientProfile(supabase, params);

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

    const u = new URL(req.url);
    const stage = u.searchParams.get("stage");
    const isFirstTurn = stage === "start";

    // ------------------------------------------------------------
    // Fallback nach fehlgeschlagener Weiterleitung
    // ------------------------------------------------------------
    if (stage === "transfer-fallback") {
      const dialCallStatus = (params.DialCallStatus || "").toLowerCase();

      if (
        dialCallStatus &&
        dialCallStatus !== "completed" &&
        conv?.id
      ) {
        await patchConversationState({
          supabase,
          id: conv.id,
          patch: {
            handoff: {
              mode: "escalation",
              source: "fallback",
              choice: "message",
              stage: "awaiting_message",
              question: null,
              customerName: null,
              customerPhone: fromNumber ?? null,
            },
          },
        });

        const g = vr.gather({
          input: ["speech"],
          language: "de-DE",
          action: `${base}/api/call/handle`,
          method: "POST",
          speechTimeout: "auto",
          timeout: 12,
          actionOnEmptyResult: true,
        });

        sayWithTTS(
          g,
          "Ich konnte Sie leider nicht direkt verbinden. Möchten Sie stattdessen eine Nachricht hinterlassen? Sagen Sie mir dann bitte kurz, worum es geht.",
          base
        );

        return new Response(vr.toString(), {
          headers: { "Content-Type": "text/xml" },
        });
      }
    }

    if (isFirstTurn) {
      const g = vr.gather({
        input: ["speech"],
        language: "de-DE",
        action: `${base}/api/call/handle`,
        method: "POST",
        speechTimeout: "auto",
        timeout: 12,
        actionOnEmptyResult: true,
      });

      sayWithTTS(g, buildGreeting(clientProfile), base);

      return new Response(vr.toString(), {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // ------------------------------------------------------------
    // Kein UserText -> retry logic / Eskalation nach 3x
    // ------------------------------------------------------------
    if (!userText) {
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
        if (conv?.id) {
          await patchConversationState({
            supabase,
            id: conv.id,
            patch: {
              handoff: {
                mode: "escalation",
                source: "fallback",
                choice: null,
                stage: "awaiting_choice",
                question: null,
                customerName: null,
                customerPhone: fromNumber ?? null,
              },
            },
          });
        }

        const g = vr.gather({
          input: ["speech"],
          language: "de-DE",
          action: `${base}/api/call/handle`,
          method: "POST",
          speechTimeout: "auto",
          timeout: 12,
          actionOnEmptyResult: true,
        });

        sayWithTTS(
          g,
          "Ich konnte Sie leider nicht verstehen. Möchten Sie direkt mit einem Mitarbeiter sprechen oder soll ich eine Nachricht hinterlassen, damit sich das Unternehmen bei Ihnen meldet?",
          base
        );

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
        timeout: 12,
        actionOnEmptyResult: true,
      });

      const msg =
        count === 1
          ? "Ich habe Sie gerade kurz nicht gehört. Sagen Sie zum Beispiel: Termin buchen oder Öffnungszeiten."
          : "Ich höre Sie leider nicht. Sagen Sie bitte kurz: Termin oder Frage – zum Beispiel Preise oder Adresse.";

      sayWithTTS(g, msg, base);

      return new Response(vr.toString(), {
        headers: { "Content-Type": "text/xml" },
      });
    }

    try {
      if (conv) {
        await resetCounters({ supabase, conv });
      }
    } catch {}

    // ------------------------------------------------------------
    // GPT-Receptionist
    // ------------------------------------------------------------
    let reply = "Alles klar. Ich habe das so notiert.";
    let endCall = false;
    let out: any = null;

    try {
      out = await runGptReceptionistFlow({
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

    // ------------------------------------------------------------
    // Echte Weiterleitung
    // ------------------------------------------------------------
    if (out?.success && out?.status === "transfer_requested") {
      const forwardTo = clientProfile?.phone?.trim();

      if (forwardTo) {
        buildTransferTwiml({
          vr,
          base,
          targetNumber: forwardTo,
          callerId: toNumber || clientProfile?.twilio_number || undefined,
        });

        return new Response(vr.toString(), {
          headers: { "Content-Type": "text/xml" },
        });
      }

      // Kein forwarding hinterlegt -> zurück auf Handoff-Nachricht
      if (conv?.id) {
        await patchConversationState({
          supabase,
          id: conv.id,
          patch: {
            handoff: {
              mode: "escalation",
              source: "fallback",
              choice: "message",
              stage: "awaiting_message",
              question: null,
              customerName: null,
              customerPhone: fromNumber ?? null,
            },
          },
        });
      }

      const g = vr.gather({
        input: ["speech"],
        language: "de-DE",
        action: `${base}/api/call/handle`,
        method: "POST",
        speechTimeout: "auto",
        timeout: 12,
        actionOnEmptyResult: true,
      });

      sayWithTTS(
        g,
        "Ich kann Sie gerade leider nicht direkt verbinden. Sie können mir aber gerne eine Nachricht hinterlassen, damit sich das Unternehmen bei Ihnen meldet. Worum geht es genau?",
        base
      );

      return new Response(vr.toString(), {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Antwort ausspielen
    sayWithTTS(vr, reply, base);

    if (endCall) {
      vr.hangup();
      return new Response(vr.toString(), {
        headers: { "Content-Type": "text/xml" },
      });
    }

    vr.gather({
      input: ["speech"],
      language: "de-DE",
      action: `${base}/api/call/handle`,
      method: "POST",
      speechTimeout: "auto",
      timeout: 12,
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
      "Ich habe leider nichts gehört. Versuchen Sie es bitte noch einmal oder rufen Sie später nochmal an. Auf Wiederhören.",
      base
    );
    return new Response(vr.toString(), {
      headers: { "Content-Type": "text/xml" },
    });
  }
}