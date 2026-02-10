// lib/callflow/gptReceptionist.ts
import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureConversationState, incrementCounter } from "@/lib/conversation-state";
import { runAppointmentFlow } from "@/lib/callflow/appointment";
import { runFaqFlow } from "@/lib/callflow/faq";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export type ReceptionistInput = {
  supabase: SupabaseClient; // ✅ von call/handle reinreichen (createServiceClient nur 1x)
  text: string;
  fromNumber?: string | null;
  toNumber?: string | null;
  clientId?: string | null;
  sessionId?: string | null;
};

type BrainResponse = {
  intent:
    | "create_appointment"
    | "cancel_appointment"
    | "reschedule_appointment"
    | "appointment_info"
    | "availability"
    | "staff_availability"
    | "appointment_confirm"
    | "faq"
    | "other"
    // legacy aliases
    | "appointment"
    | "appointment_booking"
    | "route_appointment";
  reply: string | null;
  confidence: number;
  end_call: boolean;
  meta?: any;
};

export type ReceptionistResult =
  | {
      success: true;
      intent: string;
      confidence: number;
      end_call: boolean;
      reply: string;

      brain?: {
        raw?: unknown;
        meta?: any;
      };

      // downstream passthrough (appointment/faq)
      status?: string;
      message?: string;
      question?: string;
      missing?: string;
      suggestions?: string[];
      staff?: string | null;
      date?: string | null;

      // appointment extras
      appointment?: any;
      appointmentId?: string;
      preview?: string;
      phrase?: string;
      draftId?: string | null;
      calendarSynced?: boolean;
      calendarError?: string | null;

      // faq extras
      answer?: string;
      handoffId?: string;
    }
  | {
      success: false;
      error: string;
      details?: string;
    };

function clamp01(n: any, fallback = 0.5) {
  const x = Number.isFinite(Number(n)) ? Number(n) : fallback;
  return Math.max(0, Math.min(1, x));
}

function safeJsonParse(s: string): any | null {
  try {
    return JSON.parse(s);
  } catch {
    const match = s.match(/\{[\s\S]*\}$/m);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function hardEndFromText(text: string) {
  const t = (text || "").trim().toLowerCase();
  if (t.length > 60) return false;

  const phrases = [
    "tschüss",
    "ciao",
    "auf wiederhören",
    "danke das war alles",
    "danke, das war alles",
    "ne, das war's",
    "ne das war's",
    "das war's",
    "das wars",
    "das war alles",
    ];

  return phrases.some((p) => t.includes(p));
}

function buildSystemPrompt(profileText: string) {
  return `
Du bist eine freundliche Telefon-Rezeptionistin.

${profileText ? `UNTERNEHMENSPROFIL (nur intern, nicht vorlesen):
${profileText}
` : ""}

WICHTIG: Du gibst IMMER NUR ein gültiges JSON zurück (ohne Markdown, ohne Text außenrum).

Schema (genau so):
{
  "intent": "create_appointment" | "cancel_appointment" | "reschedule_appointment" | "appointment_info" | "availability" | "staff_availability" | "appointment_confirm" | "faq" | "other",
  "reply": string | null,
  "confidence": number,
  "end_call": boolean,
  "meta": object | null
}

Regeln:
- Wenn der Nutzer eine Frage zu Öffnungszeiten/Preisen/Adresse/Services/sonstigen Infos stellt → intent="faq" und reply=null.
- Wenn der Nutzer einen Termin buchen/ändern/stornieren will → passende Appointment-Intents, reply=null.
- Wenn der Nutzer eindeutig bestätigt ("ja", "bitte buchen", "bestätige", "mach das") und es klingt nach Termin bestätigen → intent="appointment_confirm", reply=null.
- Wenn du nicht sicher bist → intent="other", reply="freundliche Rückfrage", confidence niedrig.
- confidence zwischen 0 und 1.
- Wenn der Nutzer nach abgeschlossenem intent klar sagt "das war´s", "tschüss", "danke", etc, -> end_call: true + reply = kurze Verabschiedung
- Wenn intent other und confidence niedrig -> Rückfrage + end_call: false
- meta optional: nutze meta nur für interne Hinweise (z.B. { "parsed": {...} }), ansonsten null.
`.trim();
}

type ClientSettings = {
  id: string;
  ai_profile: string | null;
  owner_user: string | null;
  timezone: string | null;
  staff_enabled: boolean | null;
};

export async function runGptReceptionistFlow(
  input: ReceptionistInput
): Promise<ReceptionistResult> {
  try {
    const { supabase, text, clientId: clientIdFromInput, sessionId } = input;

    if (!text || typeof text !== "string") {
      return { success: false, error: "missing_text" };
    }

    // 1) Client + Profile + Settings laden
    let profileText = "";
    let resolvedClientId: string | null = null;
    let ownerUserId: string | null = null;
    let timezone: string = "Europe/Berlin";
    let staffEnabled: boolean = true;

    if (clientIdFromInput) {
      const { data, error } = await supabase
        .from("clients")
        .select("id, ai_profile, owner_user , timezone, staff_enabled")
        .eq("id", clientIdFromInput)
        .maybeSingle<ClientSettings>();

      if (error) console.error("[BRAIN] client load error (by clientId)", error);

      resolvedClientId = data?.id ?? clientIdFromInput;
      profileText = data?.ai_profile ?? "";
      ownerUserId = data?.owner_user ?? null;
      timezone = data?.timezone ?? "Europe/Berlin";
      staffEnabled = Boolean(data?.staff_enabled ?? true);
    } else {
      // Debug/Admin-Fallback: neuester Client mit Profil
      const { data, error } = await supabase
        .from("clients")
        .select("id, ai_profile, owner_user , timezone, staff_enabled")
        .not("ai_profile", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<ClientSettings>();

      if (error) console.error("[BRAIN] client load error (no clientId)", error);

      resolvedClientId = data?.id ?? null;
      profileText = data?.ai_profile ?? "";
      ownerUserId = data?.owner_user ?? null;
      timezone = data?.timezone ?? "Europe/Berlin";
      staffEnabled = Boolean(data?.staff_enabled ?? true);
    }

    // 1b) Harte Ende-Regel
    if (hardEndFromText(text)) {
      return {
        success: true,
        intent: "other",
        confidence: 0.9,
        end_call: true,
        reply: "Alles klar. Vielen Dank für Ihren Anruf. Auf Wiederhören.",
      };
    }

    // 2) Brain LLM Call
    const system = buildSystemPrompt(profileText);

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Nutzer sagt am Telefon: """${text}"""` },
      ],
    });

    const content = resp.choices[0]?.message?.content ?? "{}";
    let brain = safeJsonParse(content) as BrainResponse | null;

    if (!brain || typeof brain !== "object") {
      brain = {
        intent: "other",
        reply:
          "Entschuldigung, das habe ich nicht ganz verstanden. Geht es um einen Termin oder haben Sie eine kurze Frage, zum Beispiel zu Öffnungszeiten oder Preisen?",
        confidence: 0.2,
        end_call: false,
        meta: null,
      };
    }

    const intent = String(brain.intent || "other").toLowerCase();
    const confidence = clamp01(brain.confidence, 0.5);
    const endCallFromBrain = Boolean(brain.end_call);

    // 3) Low-confidence other → Rückfrage + Counter
    if (intent === "other" && confidence < 0.35) {
      if (resolvedClientId && sessionId) {
        try {
          const conv = await ensureConversationState({
            supabase,
            clientId: resolvedClientId,
            sessionId,
            channel: "phone",
          });

          const count = await incrementCounter({
            supabase,
            conv,
            key: "noUnderstandCount",
          });

          if (count >= 3) {
            return {
              success: true,
              intent: "other",
              confidence,
              end_call: true,
              reply:
                "Entschuldigung – ich verstehe Sie gerade leider nicht. Ich verbinde Sie kurz mit einem Mitarbeiter. Auf Wiederhören.",
              brain: { raw: brain, meta: brain.meta },
            };
          }
        } catch (e) {
          console.warn("[BRAIN] increment noUnderstandCount failed", e);
        }
      }

      return {
        success: true,
        intent,
        confidence,
        end_call: false,
        reply:
          brain.reply ||
          "Entschuldigung, das habe ich nicht ganz verstanden. Geht es um einen Termin oder haben Sie eine kurze Frage, zum Beispiel zu Öffnungszeiten oder Preisen?",
        brain: { raw: brain, meta: brain.meta },
      };
    }

    const appointmentIntents = new Set([
      "create_appointment",
      "cancel_appointment",
      "reschedule_appointment",
      "appointment_info",
      "availability",
      "staff_availability",
      "appointment_confirm",
      // legacy
      "appointment",
      "appointment_booking",
      "route_appointment",
    ]);

    const baseResult = {
      success: true as const,
      intent,
      confidence,
      end_call: endCallFromBrain,
      reply:
        (typeof brain.reply === "string" && brain.reply) ||
        "Gern. Möchten Sie einen Termin buchen oder haben Sie eine kurze Frage – zum Beispiel zu Öffnungszeiten oder Preisen?",
      brain: { raw: brain, meta: brain.meta },
    };

    // Ohne Client → nur brain reply
    if (!resolvedClientId) return baseResult;

    // Appointment/Confirm braucht ownerUserId für Google Calendar
    // Falls bei manchen Clients null: graceful fallback (kein Calendar Sync)
    const safeOwnerUserId = ownerUserId ?? "";

    if (appointmentIntents.has(intent)) {
      const normalizedIntent =
        intent === "appointment" ||
        intent === "appointment_booking" ||
        intent === "route_appointment"
          ? "create_appointment"
          : intent;

      const out: any = await runAppointmentFlow({
        supabase,
        clientId: resolvedClientId,
        ownerUserId: safeOwnerUserId,
        timezone,
        staffEnabled,
        message: text,
        sessionId,
        brainIntent: normalizedIntent,
      });

      let reply = baseResult.reply;
      if (out?.status === "need_info" && out?.question) reply = out.question;
      else if (out?.message) reply = out.message;
      else if (out?.reply) reply = out.reply;
      else if (out?.phrase) reply = out.phrase;

      return {
        ...baseResult,
        ...out,
        intent: normalizedIntent,
        reply,
        end_call:
          typeof out?.end_call === "boolean" ? Boolean(out.end_call) : baseResult.end_call,
      };
    }

    if (intent === "faq") {
      const out: any = await runFaqFlow({
        supabase,
        clientId: resolvedClientId,
        message: text,
        sessionId: sessionId ?? null, // ✅ Type ist jetzt vorhanden
        userId: null,
      });

      // FAQ → optional direkt weiter in appointment flow
      if (out?.status === "route_appointment") {
        const ap: any = await runAppointmentFlow({
          supabase,
          clientId: resolvedClientId,
          ownerUserId: safeOwnerUserId,
          timezone,
          staffEnabled,
          message: text,
          sessionId,
          brainIntent: "create_appointment",
        });

        let apReply = "Gern. Für welches Datum möchten Sie den Termin? Sagen Sie zum Beispiel: ‚08.02.2026‘.";
        if (ap?.status === "need_info" && ap?.question) apReply = ap.question;
        else if (ap?.message) apReply = ap.message;
        else if (ap?.phrase) apReply = ap.phrase;

        return {
          ...baseResult,
          ...ap,
          intent: "create_appointment",
          reply: apReply,
          end_call:
            typeof ap?.end_call === "boolean" ? Boolean(ap.end_call) : baseResult.end_call,
        };
      }

      const reply = out?.answer ?? out?.message ?? "Okay.";

      return {
        ...baseResult,
        ...out,
        reply,
        end_call:
          typeof out?.end_call === "boolean" ? Boolean(out.end_call) : baseResult.end_call,
      };
    }

    return baseResult;
  } catch (err: any) {
    console.error("[GPT receptionist] ERROR", err);
    const details = err instanceof Error ? err.message : String(err ?? "unknown");
    return { success: false, error: "internal_error", details };
  }
}
