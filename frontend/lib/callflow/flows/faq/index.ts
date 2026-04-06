import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivePlan, ConversationStateJson } from "@/lib/callflow/types";
import { buildFaqContext } from "@/lib/callflow/flows/faq/context";
import { matchFaq } from "@/lib/callflow/flows/faq/matcher";
import { parseService } from "@/lib/callflow/parsers/service";
import { buildFaqBasicAppointmentReply, buildGenericFallbackReply } from "@/lib/callflow/response-builder";

type HandleFaqFlowArgs = {
  supabase: SupabaseClient;
  clientId: string;
  text: string;
  activePlan: ActivePlan;
  state: ConversationStateJson;
};

export type FaqFlowResult = {
  matched: boolean;
  reply: string;
  statePatch: ConversationStateJson;
  confidence: number;
};

export async function handleFaqFlow(
  args: HandleFaqFlowArgs
): Promise<FaqFlowResult> {
  const { supabase, clientId, text, activePlan, state } = args;

  const ctx = await buildFaqContext(supabase, clientId);
  const normalized = (text || "").toLowerCase();
  const looksLikePrice = ["preis", "preise", "kosten", "wie viel kostet", "was kostet"].some((p) =>
    normalized.includes(p)
  );
  const looksLikeDuration = ["wie lange", "dauer", "wie lang", "wie viel zeit"].some((p) =>
    normalized.includes(p)
  );

  // Priority guard: Preisfragen niemals in generischen Fallback kippen lassen.
  if (looksLikePrice) {
    const parsed = parseService({ text, services: ctx.services });

    if (parsed.value) {
      const price = parsed.value.price_cents;
      return {
        matched: true,
        reply:
          price != null
            ? `${parsed.value.title} kostet ${price / 100} Euro.`
            : `Für ${parsed.value.title} ist aktuell kein Preis hinterlegt.`,
        confidence: Math.max(0.72, parsed.confidence),
        statePatch: {
          ...state,
          flow: "faq",
          step: "done",
          lastIntent: "faq",
        },
      };
    }

    return {
      matched: true,
      reply:
        ctx.services.length > 0
          ? "Für welche Leistung möchten Sie den Preis wissen? Zum Beispiel: Haarschnitt oder Balayage."
          : "Aktuell sind keine Service-Preise hinterlegt.",
      confidence: 0.7,
      statePatch: {
        ...state,
        flow: "faq",
        step: "done",
        lastIntent: "faq",
      },
    };
  }

  if (looksLikeDuration) {
    const parsed = parseService({ text, services: ctx.services });

    if (parsed.value) {
      const duration = parsed.value.duration_min;
      return {
        matched: true,
        reply:
          duration != null
            ? `${parsed.value.title} dauert ungefähr ${duration} Minuten.`
            : `Für ${parsed.value.title} ist aktuell keine Dauer hinterlegt.`,
        confidence: Math.max(0.72, parsed.confidence),
        statePatch: {
          ...state,
          flow: "faq",
          step: "done",
          lastIntent: "faq",
        },
      };
    }

    return {
      matched: true,
      reply:
        ctx.services.length > 0
          ? "Für welche Leistung möchten Sie die Dauer wissen? Zum Beispiel: Haarschnitt oder Balayage."
          : "Aktuell sind keine Service-Dauern hinterlegt.",
      confidence: 0.7,
      statePatch: {
        ...state,
        flow: "faq",
        step: "done",
        lastIntent: "faq",
      },
    };
  }

  const match = matchFaq(text, ctx);

  if (match.matched) {
    return {
      matched: true,
      reply: match.answer,
      confidence: match.confidence,
      statePatch: {
        ...state,
        flow: "faq",
        step: "done",
        lastIntent: "faq",
      },
    };
  }

  if (activePlan === "faq_basic") {
    return {
      matched: true,
      reply: buildFaqBasicAppointmentReply(),
      confidence: 0.7,
      statePatch: {
        ...state,
        flow: "faq",
        step: "done",
        lastIntent: "faq",
      },
    };
  }

  return {
    matched: false,
    reply: buildGenericFallbackReply(),
    confidence: 0,
    statePatch: {
      ...state,
      flow: "faq",
      step: "done",
      lastIntent: "faq",
    },
  };
}
