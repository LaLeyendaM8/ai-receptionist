// lib/ai/conversation-state.ts
import { SupabaseClient } from "@supabase/supabase-js";

export type AppointmentCS = {
  mode?: "booking" | "info" | "cancel" | "reschedule";
  draftId?: string | null;
  date?: string | null;
  time?: string | null;
  serviceId?: string | null;
  serviceName?: string | null;
  staffId?: string | null;
  staffName?: string | null;
  customerName?: string | null;
  phone?: string | null;
};

export type ConversationStateJson = {
  lastIntent?: string;
  step?: string;
  appointment?: AppointmentCS;
  // future: faq, handoffs, ...
};

export type ConversationState = {
  id: string;
  client_id: string;
  channel: string;
  session_id: string;
  state: ConversationStateJson;
};

type EnsureArgs = {
  supabase: SupabaseClient;
  clientId: string;
  sessionId: string;
  channel?: string; // default: "phone"
};

export async function ensureConversationState({
  supabase,
  clientId,
  sessionId,
  channel = "phone",
}: EnsureArgs): Promise<ConversationState> {
  const { data, error } = await supabase
    .from("conversation_state")
    .select("*")
    .eq("client_id", clientId)
    .eq("channel", channel)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error("[CSH] load error", error);
    throw error;
  }

  if (data) {
    return {
      ...data,
      state: (data.state ?? {}) as ConversationStateJson,
    } as ConversationState;
  }

  const insert = {
    client_id: clientId,
    channel,
    session_id: sessionId,
    state: {},
  };

  const { data: created, error: cErr } = await supabase
    .from("conversation_state")
    .insert(insert)
    .select()
    .single();

  if (cErr || !created) {
    console.error("[CSH] create error", cErr);
    throw cErr;
  }

  return {
    ...created,
    state: (created.state ?? {}) as ConversationStateJson,
  } as ConversationState;
}

type PatchArgs = {
  supabase: SupabaseClient;
  id: string;
  patch: Partial<ConversationStateJson>;
};

export async function patchConversationState({
  supabase,
  id,
  patch,
}: PatchArgs): Promise<void> {
  const { error } = await supabase
    .from("conversation_state")
    .update({
      state: patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("[CSH] patch error", error);
    throw error;
  }
}

type ClearArgs = {
  supabase: SupabaseClient;
  clientId: string;
  sessionId: string;
  channel?: string;
};

export async function clearConversationState({
  supabase,
  clientId,
  sessionId,
  channel = "phone",
}: ClearArgs): Promise<void> {
  const { error } = await supabase
    .from("conversation_state")
    .delete()
    .eq("client_id", clientId)
    .eq("channel", channel)
    .eq("session_id", sessionId);

  if (error) {
    console.error("[CSH] clear error", error);
    throw error;
  }
}
