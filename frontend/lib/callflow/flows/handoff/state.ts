import type { ConversationStateJson, HandoffState } from "@/lib/callflow/types";

export function createInitialHandoffState(
  source: "faq" | "human_handoff" | "fallback" = "human_handoff"
): HandoffState {
  return {
    mode: "escalation",
    source,
    choice: null,
    stage: "awaiting_choice",
    question: null,
    customerName: null,
    customerPhone: null,
  };
}

export function resetHandoffState(): HandoffState {
  return {
    mode: null,
    source: null,
    choice: null,
    stage: null,
    question: null,
    customerName: null,
    customerPhone: null,
  };
}

export function withHandoffState(
  state: ConversationStateJson,
  handoff: HandoffState
): ConversationStateJson {
  return {
    ...state,
    flow: handoff.stage ? "handoff" : "idle",
    handoff,
  };
}