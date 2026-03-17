import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConversationStateJson, HandoffState } from "@/lib/callflow/types";
import {
  cleanName,
  extractPhone,
  looksAffirmative,
  looksLikeMessageChoice,
  looksLikeTransferChoice,
  looksNegative,
} from "@/lib/callflow/flows/handoff/helpers";
import {
  createInitialHandoffState,
  resetHandoffState,
} from "@/lib/callflow/flows/handoff/state";

type HandleHandoffFlowArgs = {
  supabase: SupabaseClient;
  clientId: string;
  text: string;
  state: ConversationStateJson;
  fromNumber?: string | null;
};

export type HandoffFlowResult = {
  reply: string;
  statePatch: ConversationStateJson;
  completed: boolean;
  transfer?: boolean;
};

async function createAndNotifyHandoff(args: {
  supabase: SupabaseClient;
  clientId: string;
  handoff: HandoffState;
  fromNumber?: string | null;
}) {
  const { supabase, clientId, handoff, fromNumber } = args;

  const { data, error } = await supabase
    .from("handoffs")
    .insert({
      client_id: clientId,
      question: handoff.question ?? "",
      customer_name: handoff.customerName ?? null,
      customer_phone: handoff.customerPhone ?? fromNumber ?? null,
      kind: handoff.choice ?? "message",
      status: "open",
      source: "phone_ai",
    })
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[HANDOFF] create handoff error", error);
    throw error;
  }

  return data;
}

function askHandoffChoice() {
  return "Gerne. Möchten Sie direkt verbunden werden oder soll ich eine Nachricht für das Team aufnehmen?";
}

function askMessageText() {
  return "Was möchten Sie dem Team mitteilen?";
}

function askName() {
  return "Wie ist Ihr Name?";
}

function askPhone() {
  return "Unter welcher Telefonnummer können wir Sie zurückrufen?";
}

function askPhoneConfirm(phone: string) {
  return `Ich habe die Nummer ${phone} notiert. Ist das richtig?`;
}

export async function handleHandoffFlow(
  args: HandleHandoffFlowArgs
): Promise<HandoffFlowResult> {
  const { supabase, clientId, text, state, fromNumber } = args;

  const handoff: HandoffState = state.handoff?.stage
    ? { ...(state.handoff ?? {}) }
    : createInitialHandoffState("human_handoff");

  if (!handoff.stage || handoff.stage === "awaiting_choice") {
    if (looksLikeTransferChoice(text)) {
      return {
        reply: "Alles klar, ich versuche Sie jetzt zu verbinden.",
        statePatch: {
          ...state,
          flow: "handoff",
          step: "done",
          lastIntent: "handoff",
          handoff: {
            ...handoff,
            choice: "transfer",
            stage: null,
          },
        },
        completed: true,
        transfer: true,
      };
    }

    if (looksLikeMessageChoice(text)) {
      return {
        reply: askMessageText(),
        statePatch: {
          ...state,
          flow: "handoff",
          step: "message",
          lastIntent: "handoff",
          handoff: {
            ...handoff,
            choice: "message",
            stage: "awaiting_message",
          },
        },
        completed: false,
      };
    }

    return {
      reply: askHandoffChoice(),
      statePatch: {
        ...state,
        flow: "handoff",
        step: "choice",
        lastIntent: "handoff",
        handoff,
      },
      completed: false,
    };
  }

  if (handoff.stage === "awaiting_message") {
    const question = (text || "").trim();

    if (!question) {
      return {
        reply: askMessageText(),
        statePatch: {
          ...state,
          flow: "handoff",
          step: "message",
          lastIntent: "handoff",
          handoff,
        },
        completed: false,
      };
    }

    return {
      reply: askName(),
      statePatch: {
        ...state,
        flow: "handoff",
        step: "name",
        lastIntent: "handoff",
        handoff: {
          ...handoff,
          question,
          stage: "awaiting_name",
        },
      },
      completed: false,
    };
  }

  if (handoff.stage === "awaiting_name") {
    const customerName = cleanName(text);

    if (!customerName) {
      return {
        reply: askName(),
        statePatch: {
          ...state,
          flow: "handoff",
          step: "name",
          lastIntent: "handoff",
          handoff,
        },
        completed: false,
      };
    }

    return {
      reply: askPhone(),
      statePatch: {
        ...state,
        flow: "handoff",
        step: "phone",
        lastIntent: "handoff",
        handoff: {
          ...handoff,
          customerName,
          stage: "awaiting_phone",
        },
      },
      completed: false,
    };
  }

  if (handoff.stage === "awaiting_phone") {
    const customerPhone = extractPhone(text) ?? fromNumber ?? null;

    if (!customerPhone) {
      return {
        reply: askPhone(),
        statePatch: {
          ...state,
          flow: "handoff",
          step: "phone",
          lastIntent: "handoff",
          handoff,
        },
        completed: false,
      };
    }

    return {
      reply: askPhoneConfirm(customerPhone),
      statePatch: {
        ...state,
        flow: "handoff",
        step: "phone_confirm",
        lastIntent: "handoff",
        handoff: {
          ...handoff,
          customerPhone,
          stage: "awaiting_phone_confirm",
        },
      },
      completed: false,
    };
  }

  if (handoff.stage === "awaiting_phone_confirm") {
    if (looksAffirmative(text)) {
      await createAndNotifyHandoff({
        supabase,
        clientId,
        handoff,
        fromNumber,
      });

      return {
        reply: "Perfekt, ich habe Ihre Nachricht aufgenommen und an das Team weitergegeben.",
        statePatch: {
          ...state,
          flow: "idle",
          step: "done",
          lastIntent: "handoff",
          handoff: resetHandoffState(),
        },
        completed: true,
      };
    }

    if (looksNegative(text)) {
      return {
        reply: askPhone(),
        statePatch: {
          ...state,
          flow: "handoff",
          step: "phone",
          lastIntent: "handoff",
          handoff: {
            ...handoff,
            customerPhone: null,
            stage: "awaiting_phone",
          },
        },
        completed: false,
      };
    }

    return {
      reply: askPhoneConfirm(handoff.customerPhone ?? ""),
      statePatch: {
        ...state,
        flow: "handoff",
        step: "phone_confirm",
        lastIntent: "handoff",
        handoff,
      },
      completed: false,
    };
  }

  return {
    reply: askHandoffChoice(),
    statePatch: {
      ...state,
      flow: "handoff",
      step: "choice",
      lastIntent: "handoff",
      handoff: createInitialHandoffState("human_handoff"),
    },
    completed: false,
  };
}