import type {
  OrchestratorInput,
  OrchestratorResult,
  OrchestratorFailure,
  ResolvedCallContext,
} from "@/lib/callflow/types";
import {
  ensureConversationState,
} from "@/lib/callflow/conversation-state";
import { routeIntent } from "@/lib/callflow/intent-router";
import {
  buildGenericFallbackReply,
  buildPlanBlockedReply,
} from "@/lib/callflow/response-builder";
import { runGptReceptionistFlow } from "@/lib/callflow/gpt-receptionist";
import { patchConversationState } from "@/lib/callflow/conversation-state";
import { handleAppointmentFlow } from "@/lib/callflow/flows/appointment";
import { handleFaqFlow } from "@/lib/callflow/flows/faq";
import { handleHandoffFlow } from "@/lib/callflow/flows/handoff";

type ClientSettings = {
  id: string;
  ai_profile: string | null;
  owner_user: string | null;
  timezone: string | null;
  staff_enabled: boolean | null;
};

async function resolveCallContext(args: {
  supabase: OrchestratorInput["supabase"];
  clientId?: string | null;
}): Promise<ResolvedCallContext> {
  const { supabase, clientId } = args;

  let resolvedClientId: string | null = null;
  let aiProfile = "";
  let ownerUserId: string | null = null;
  let timezone = "Europe/Berlin";
  let staffEnabled = true;
  let activePlan: "faq_basic" | "starter" | "none" = "none";

  if (clientId) {
    const { data, error } = await supabase
      .from("clients")
      .select("id, ai_profile, owner_user, timezone, staff_enabled")
      .eq("id", clientId)
      .maybeSingle<ClientSettings>();

    if (error) {
      console.error("[ORCHESTRATOR] client load error", error);
    }

    resolvedClientId = data?.id ?? clientId;
    aiProfile = data?.ai_profile ?? "";
    ownerUserId = data?.owner_user ?? null;
    timezone = data?.timezone ?? "Europe/Berlin";
    staffEnabled = Boolean(data?.staff_enabled ?? true);
  }

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
      console.error("[ORCHESTRATOR] subscription load error", subErr);
    }

    const rawPlan = String(subRow?.plan ?? "").toLowerCase();

    if (rawPlan === "faq_basic") activePlan = "faq_basic";
    else if (rawPlan === "starter") activePlan = "starter";
    else activePlan = "none";
  }

  return {
    clientId: resolvedClientId,
    ownerUserId,
    timezone,
    staffEnabled,
    activePlan,
    aiProfile,
  };
}

export async function runCallflowOrchestrator(
  input: OrchestratorInput
): Promise<OrchestratorResult | OrchestratorFailure> {
  try {
    const {
      supabase,
      text,
      fromNumber,
      toNumber,
      clientId,
      sessionId,
    } = input;

    if (!text || typeof text !== "string") {
      return { success: false, error: "missing_text" };
    }

    const ctx = await resolveCallContext({
      supabase,
      clientId,
    });

    if (ctx.activePlan === "none") {
      return {
        success: true,
        intent: "other",
        confidence: 1,
        end_call: false,
        reply: buildPlanBlockedReply(),
      };
    }

    let conv: Awaited<ReturnType<typeof ensureConversationState>> | null = null;

    if (ctx.clientId && sessionId) {
      try {
        conv = await ensureConversationState({
          supabase,
          clientId: ctx.clientId,
          sessionId,
          channel: "phone",
        });
      } catch (err) {
        console.warn("[ORCHESTRATOR] ensureConversationState failed", err);
      }
    }

    const state = conv?.state ?? {};
    const appointmentState = state.appointment ?? {};
    const handoffState = state.handoff ?? {};
    const lastIntent = state.lastIntent;
    const hasActiveHandoff = Boolean(handoffState?.stage);
const hasActiveAppointment =
  state.flow === "appointment" ||
  [
    "create_appointment",
    "availability",
    "appointment_confirm",
    "cancel_appointment",
    "reschedule_appointment",
    "appointment_info",
  ].includes(String(lastIntent ?? ""));
  
   let route: "appointment" | "faq" | "handoff" | "fallback";

if (hasActiveHandoff) {
  route = "handoff";
} else if (hasActiveAppointment) {
  route = "appointment";
} else {
  route = routeIntent({
    text,
    lastIntent,
    appointmentState,
    handoffState,
  });
}
  
if (route === "appointment" && ctx.clientId) {
  const result = await handleAppointmentFlow({
    supabase,
    clientId: ctx.clientId,
    timezone: ctx.timezone,
    text,
    state,
    ownerUserId: ctx.ownerUserId,
  });

  if (conv?.id) {
    try {
      await patchConversationState({
        supabase,
        id: conv.id,
        patch: result.statePatch,
      });
    } catch (err) {
      console.warn("[ORCHESTRATOR] appointment state patch failed", err);
    }
  }

  return {
    success: true,
    intent: result.statePatch.lastIntent ?? "appointment",
    confidence: 0.92,
    end_call: false,
    reply: result.reply,
  };
}

if (route === "faq" && ctx.clientId) {
  const result = await handleFaqFlow({
    supabase,
    clientId: ctx.clientId,
    text,
    activePlan: ctx.activePlan,
    state,
  });

  if (conv?.id) {
    try {
      await patchConversationState({
        supabase,
        id: conv.id,
        patch: result.statePatch,
      });
    } catch (err) {
      console.warn("[ORCHESTRATOR] faq state patch failed", err);
    }
  }

  if (result.matched) {
    return {
      success: true,
      intent: "faq",
      confidence: result.confidence,
      end_call: false,
      reply: result.reply,
    };
  }

  return await runGptReceptionistFlow({
    supabase,
    text,
    fromNumber,
    toNumber,
    clientId: ctx.clientId,
    sessionId,
  });
}

if (route === "handoff" && ctx.clientId) {
  const result = await handleHandoffFlow({
    supabase,
    clientId: ctx.clientId,
    text,
    state,
    fromNumber,
  });

  if (conv?.id) {
    try {
      await patchConversationState({
        supabase,
        id: conv.id,
        patch: result.statePatch,
      });
    } catch (err) {
      console.warn("[ORCHESTRATOR] handoff state patch failed", err);
    }
  }

  return {
    success: true,
    intent: "handoff",
    confidence: 0.95,
    end_call: false,
    reply: result.reply,
    ...(result.transfer ? { status: "transfer_requested" } : {}),
  };
}

if (route === "fallback") {
  return await runGptReceptionistFlow({
    supabase,
    text,
    fromNumber,
    toNumber,
    clientId: ctx.clientId,
    sessionId,
  });
}

return await runGptReceptionistFlow({
  supabase,
  text,
  fromNumber,
  toNumber,
  clientId: ctx.clientId,
  sessionId,
});
  } catch (err: any) {
    console.error("[ORCHESTRATOR] ERROR", err);
    return {
      success: false,
      error: "internal_error",
      details: err instanceof Error ? err.message : String(err ?? "unknown"),
    };
  }
}