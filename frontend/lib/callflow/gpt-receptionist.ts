import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ensureConversationState,
  incrementCounter,
  patchConversationState,
  type HandoffCS,
  type AppointmentCS,
} from "@/lib/callflow/conversation-state";
import { runAppointmentFlow } from "@/lib/callflow/appointment";
import { runFaqFlow } from "@/lib/callflow/faq";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export type ReceptionistInput = {
  supabase: SupabaseClient;
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
    | "human_handoff"
    | "other"
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

      status?: string;
      message?: string;
      question?: string;
      missing?: string;
      suggestions?: string[];
      staff?: string | null;
      date?: string | null;

      appointment?: any;
      appointmentId?: string;
      preview?: string;
      phrase?: string;
      draftId?: string | null;
      calendarSynced?: boolean;
      calendarError?: string | null;

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

function isAppointmentIntentLike(intent?: string | null) {
  if (!intent) return false;

  return new Set([
    "create_appointment",
    "cancel_appointment",
    "reschedule_appointment",
    "appointment_info",
    "availability",
    "staff_availability",
    "appointment_confirm",
    "appointment",
    "appointment_booking",
    "route_appointment",
  ]).has(intent);
}

function appointmentStateIsOpen(state?: AppointmentCS | null) {
  if (!state) return false;

  return Boolean(
    state.mode ||
      state.draftId ||
      state.date ||
      state.time ||
      state.serviceName ||
      state.customerName ||
      state.staffName
  );
}

function looksLikeFaqInterruption(text: string) {
  const t = (text || "").trim().toLowerCase();

  if (!t) return false;

  const faqSignals = [
    "wann habt ihr",
    "wann haben sie",
    "wie lange",
    "was kostet",
    "welche leistungen",
    "welche services",
    "wo seid ihr",
    "wo sind sie",
    "adresse",
    "telefonnummer",
    "email",
    "e-mail",
    "öffnungszeiten",
    "habt ihr offen",
    "haben sie offen",
    "preis",
    "preise",
  ];

  return faqSignals.some((p) => t.includes(p));
}

function shouldBypassBrainToAppointment(args: {
  text: string;
  lastIntent?: string;
  appointmentState?: AppointmentCS | null;
  handoffStage?: string | null;
}) {
  const { text, lastIntent, appointmentState, handoffStage } = args;

  if (handoffStage) return false;
  if (!isAppointmentIntentLike(lastIntent)) return false;
  if (!appointmentStateIsOpen(appointmentState)) return false;
  if (looksLikeFaqInterruption(text)) return false;

  return true;
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
  "intent": "create_appointment" | "cancel_appointment" | "reschedule_appointment" | "appointment_info" | "availability" | "staff_availability" | "appointment_confirm" | "faq" | "human_handoff" | "other",
  "reply": string | null,
  "confidence": number,
  "end_call": boolean,
  "meta": object | null
}

Regeln:
- Wenn der Nutzer eine Frage zu Öffnungszeiten/Preisen/Adresse/Services/sonstigen Infos stellt → intent="faq" und reply=null.
- Wenn der Nutzer einen Termin buchen/ändern/stornieren will → passende Appointment-Intents, reply=null.
- Wenn der Nutzer eindeutig bestätigt ("ja", "bitte buchen", "bestätige", "mach das") und es klingt nach Termin bestätigen → intent="appointment_confirm", reply=null.
- Wenn der Nutzer mit einem Mitarbeiter sprechen möchte, weitergeleitet werden möchte oder eine echte Person verlangt → intent="human_handoff", reply=null.
- Wenn du nicht sicher bist → intent="other", reply="freundliche Rückfrage", confidence niedrig.
- confidence zwischen 0 und 1.
- Wenn der Nutzer nach abgeschlossenem intent klar sagt "das war´s", "tschüss", "danke", etc. → end_call: true + reply = kurze Verabschiedung
- Wenn intent other und confidence niedrig → Rückfrage + end_call: false
- meta optional: nutze meta nur für interne Hinweise, ansonsten null.
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
    const {
      supabase,
      text,
      fromNumber,
      clientId: clientIdFromInput,
      sessionId,
    } = input;

    if (!text || typeof text !== "string") {
      return { success: false, error: "missing_text" };
    }

    let profileText = "";
    let resolvedClientId: string | null = null;
    let ownerUserId: string | null = null;
    let timezone = "Europe/Berlin";
    let staffEnabled = true;
    let activePlan: "faq_basic" | "starter" | "none" = "none";

    if (clientIdFromInput) {
      const { data, error } = await supabase
        .from("clients")
        .select("id, ai_profile, owner_user, timezone, staff_enabled")
        .eq("id", clientIdFromInput)
        .maybeSingle<ClientSettings>();

      if (error) console.error("[BRAIN] client load error (by clientId)", error);

      resolvedClientId = data?.id ?? clientIdFromInput;
      profileText = data?.ai_profile ?? "";
      ownerUserId = data?.owner_user ?? null;
      timezone = data?.timezone ?? "Europe/Berlin";
      staffEnabled = Boolean(data?.staff_enabled ?? true);
    } else {
      const { data, error } = await supabase
        .from("clients")
        .select("id, ai_profile, owner_user, timezone, staff_enabled")
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
        // Aktiven Plan laden (nur aktive/trialing Subscriptions zählen)
    if (resolvedClientId) {
      const { data: subRow, error: subErr } = await supabase
        .from("stripe_subscriptions")
        .select("plan, status")
        .eq("client_id", resolvedClientId)
        .in("status", ["active", "trialing"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subErr) {
        console.error("[BRAIN] subscription load error", subErr);
      }

      const rawPlan = String(subRow?.plan ?? "").toLowerCase();

      if (rawPlan === "faq_basic") activePlan = "faq_basic";
      else if (rawPlan === "starter") activePlan = "starter";
      else activePlan = "none";
    }
    if (hardEndFromText(text)) {
      return {
        success: true,
        intent: "other",
        confidence: 0.9,
        end_call: true,
        reply: "Alles klar. Vielen Dank für Ihren Anruf. Auf Wiederhören.",
      };
    }

    let conv: any = null;
    let handoffState: HandoffCS = {};
    let appointmentState: AppointmentCS = {};
    let lastIntentFromState: string | undefined = undefined;

    if (resolvedClientId && sessionId) {
      try {
        conv = await ensureConversationState({
          supabase,
          clientId: resolvedClientId,
          sessionId,
          channel: "phone",
        });

        handoffState = ((conv.state as any)?.handoff ?? {}) as HandoffCS;
        appointmentState = ((conv.state as any)?.appointment ?? {}) as AppointmentCS;
        lastIntentFromState = (conv.state as any)?.lastIntent;

      } catch (err) {
        console.warn("[BRAIN] ensureConversationState failed", err);
      }
    }
    
        // Offener Appointment-Dialog -> kurze Follow-ups direkt weiter im Appointment-Flow
    if (
      resolvedClientId &&
      shouldBypassBrainToAppointment({
        text,
        lastIntent: lastIntentFromState,
        appointmentState,
        handoffStage: handoffState?.stage ?? null,
      })
    ) {
      const safeOwnerUserId = ownerUserId ?? "";

      const out: any = await runAppointmentFlow({
        supabase,
        clientId: resolvedClientId,
        ownerUserId: safeOwnerUserId,
        timezone,
        staffEnabled,
        message: text,
        sessionId,
        brainIntent: lastIntentFromState ?? "create_appointment",
      });

      let reply =
        "Alles klar. Womit kann ich Ihnen weiterhelfen?";

      if (out?.status === "need_info" && out?.question) reply = out.question;
      else if (out?.message) reply = out.message;
      else if (out?.reply) reply = out.reply;
      else if (out?.phrase) reply = out.phrase;

      return {
        success: true,
        intent: lastIntentFromState ?? "create_appointment",
        confidence: 1,
        end_call: typeof out?.end_call === "boolean" ? Boolean(out.end_call) : false,
        reply,
        ...out,
      };
    }
    
    // Aktiver Handoff-Dialog → direkt in FAQ/Handoff-Flow
    if (resolvedClientId && handoffState?.stage) {
      const out: any = await runFaqFlow({
        supabase,
        clientId: resolvedClientId,
        message: text,
        sessionId: sessionId ?? null,
        userId: null,
        fromNumber: fromNumber ?? null,
      });

      const reply = out?.answer ?? out?.message ?? "Okay.";

      return {
        success: true,
        intent: "human_handoff",
        confidence: 1,
        end_call: false,
        reply,
        ...out,
      };
    }

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

    // Low-confidence other → Rückfrage + Counter
    if (intent === "other" && confidence < 0.35) {
      if (conv && resolvedClientId && sessionId) {
        try {
          const count = await incrementCounter({
            supabase,
            conv,
            key: "noUnderstandCount",
          });

          if (count >= 3) {
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

            return {
              success: true,
              intent: "human_handoff",
              confidence,
              end_call: false,
              reply:
                "Entschuldigung, ich verstehe Sie gerade leider nicht. Möchten Sie direkt mit einem Mitarbeiter sprechen oder soll ich eine Nachricht hinterlassen, damit sich das Unternehmen bei Ihnen meldet?",
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

        // Kein aktiver Plan -> Nutzung sauber blockieren
    if (activePlan === "none") {
      return {
        ...baseResult,
        intent: "other",
        end_call: false,
        reply:
          "Für diesen Anschluss ist aktuell noch kein aktiver Plan hinterlegt. Bitte wenden Sie sich direkt an das Unternehmen.",
      };
    }
    
    if (!resolvedClientId) return baseResult;

    const safeOwnerUserId = ownerUserId ?? "";

    if (intent === "human_handoff") {
      const out: any = await runFaqFlow({
        supabase,
        clientId: resolvedClientId,
        message: text,
        sessionId: sessionId ?? null,
        userId: null,
        fromNumber: fromNumber ?? null,
        forceHandoff: true,
      });

      const reply = out?.answer ?? out?.message ?? "Okay.";

      return {
        ...baseResult,
        ...out,
        reply,
        end_call:
          typeof out?.end_call === "boolean"
            ? Boolean(out.end_call)
            : baseResult.end_call,
      };
    }

    if (appointmentIntents.has(intent)) {
      const normalizedIntent =
        intent === "appointment" ||
        intent === "appointment_booking" ||
        intent === "route_appointment"
          ? "create_appointment"
          : intent;

      // FAQ Basic darf keine Terminaktionen ausführen -> direkt in Eskalation
      if (activePlan === "faq_basic") {
        const out: any = await runFaqFlow({
          supabase,
          clientId: resolvedClientId,
          message: text,
          sessionId: sessionId ?? null,
          userId: null,
          fromNumber: fromNumber ?? null,
          forceHandoff: true,
        });

        const reply =
          out?.answer ??
          out?.message ??
          "Für Terminbuchungen verbinde ich Sie gerne mit dem Unternehmen oder nehme eine Nachricht auf.";

        return {
          ...baseResult,
          ...out,
          intent: "human_handoff",
          reply,
          end_call:
            typeof out?.end_call === "boolean"
              ? Boolean(out.end_call)
              : baseResult.end_call,
        };
      }

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
          typeof out?.end_call === "boolean"
            ? Boolean(out.end_call)
            : baseResult.end_call,
      };
    }

    if (intent === "faq") {
      const out: any = await runFaqFlow({
        supabase,
        clientId: resolvedClientId,
        message: text,
        sessionId: sessionId ?? null,
        userId: null,
        fromNumber: fromNumber ?? null,
      });

            if (out?.status === "route_appointment") {
        if (activePlan === "faq_basic") {
          const handoffOut: any = await runFaqFlow({
            supabase,
            clientId: resolvedClientId,
            message: text,
            sessionId: sessionId ?? null,
            userId: null,
            fromNumber: fromNumber ?? null,
            forceHandoff: true,
          });

          const handoffReply =
            handoffOut?.answer ??
            handoffOut?.message ??
            "Für Terminbuchungen verbinde ich Sie gerne mit dem Unternehmen oder nehme eine Nachricht auf.";

          return {
            ...baseResult,
            ...handoffOut,
            intent: "human_handoff",
            reply: handoffReply,
            end_call:
              typeof handoffOut?.end_call === "boolean"
                ? Boolean(handoffOut.end_call)
                : baseResult.end_call,
          };
        }

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

        let apReply =
          "Gern. Für welches Datum möchten Sie den Termin? Sagen Sie zum Beispiel: „08.02.2026“.";
        if (ap?.status === "need_info" && ap?.question) apReply = ap.question;
        else if (ap?.message) apReply = ap.message;
        else if (ap?.phrase) apReply = ap.phrase;

        return {
          ...baseResult,
          ...ap,
          intent: "create_appointment",
          reply: apReply,
          end_call:
            typeof ap?.end_call === "boolean"
              ? Boolean(ap.end_call)
              : baseResult.end_call,
        };
      }

      const reply = out?.answer ?? out?.message ?? "Okay.";

      return {
        ...baseResult,
        ...out,
        reply,
        end_call:
          typeof out?.end_call === "boolean"
            ? Boolean(out.end_call)
            : baseResult.end_call,
      };
    }

    return baseResult;
  } catch (err: any) {
    console.error("[GPT receptionist] ERROR", err);
    const details = err instanceof Error ? err.message : String(err ?? "unknown");
    return { success: false, error: "internal_error", details };
  }
}