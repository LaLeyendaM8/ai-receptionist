import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivePlan, ConversationStateJson } from "@/lib/callflow/types";
import { buildFaqContext } from "@/lib/callflow/flows/faq/context";
import { matchFaq } from "@/lib/callflow/flows/faq/matcher";
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