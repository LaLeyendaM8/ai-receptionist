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

export type HandoffCS = {
  mode?: "escalation" | null;
  source?: "faq" | "human_handoff" | "fallback" | null;
  choice?: "transfer" | "message" | null;
  stage?:
    | "awaiting_choice"
    | "awaiting_message"
    | "awaiting_name"
    | "awaiting_phone"
    | "awaiting_phone_confirm"
    | null;
  question?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
};

export type ConversationStateJson = {
  lastIntent?: string;
  step?: string;
  appointment?: AppointmentCS;
  handoff?: HandoffCS;

  // Counters
  noSpeechCount?: number;
  noUnderstandCount?: number;
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
  channel?: string;
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

function isObject(v: any) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function deepMerge<T extends Record<string, any>>(base: T, patch: Partial<T>): T {
  const out: any = { ...(base ?? {}) };
  for (const [k, v] of Object.entries(patch ?? {})) {
    if (isObject(out[k]) && isObject(v)) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
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
  const { data: row, error: rErr } = await supabase
    .from("conversation_state")
    .select("state")
    .eq("id", id)
    .maybeSingle();

  if (rErr) {
    console.error("[CSH] patch load error", rErr);
    throw rErr;
  }

  const current = (row?.state ?? {}) as ConversationStateJson;
  const merged = deepMerge(current, patch);

  const { error } = await supabase
    .from("conversation_state")
    .update({
      state: merged,
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

type CounterKey = "noSpeechCount" | "noUnderstandCount";

export async function incrementCounter(args: {
  supabase: SupabaseClient;
  conv: ConversationState;
  key: CounterKey;
}): Promise<number> {
  const { supabase, conv, key } = args;
  const current = Number((conv.state as any)?.[key] ?? 0);
  const next = current + 1;

  await patchConversationState({
    supabase,
    id: conv.id,
    patch: { [key]: next } as any,
  });

  return next;
}

export async function resetCounters(args: {
  supabase: SupabaseClient;
  conv: ConversationState;
}): Promise<void> {
  const { supabase, conv } = args;
  await patchConversationState({
    supabase,
    id: conv.id,
    patch: { noSpeechCount: 0, noUnderstandCount: 0 },
  });
}