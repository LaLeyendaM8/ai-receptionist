import type { SupabaseClient } from "@supabase/supabase-js";

type CallMeta = Record<string, unknown>;

function asObject(value: unknown): CallMeta {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as CallMeta)
    : {};
}

async function loadCallBySid(args: {
  supabase: SupabaseClient;
  clientId: string;
  callSid: string;
}) {
  const { supabase, clientId, callSid } = args;

  const { data, error } = await supabase
    .from("calls")
    .select("*")
    .eq("client_id", clientId)
    .contains("meta", { twilio_call_sid: callSid })
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[CALL_LOG] loadCallBySid error", error);
    throw error;
  }

  return data;
}

export async function ensureCallLogStarted(args: {
  supabase: SupabaseClient;
  clientId: string;
  callSid?: string | null;
  fromNumber?: string | null;
  toNumber?: string | null;
  language?: string | null;
  startedAt?: string | null;
}) {
  const {
    supabase,
    clientId,
    callSid,
    fromNumber,
    toNumber,
    language,
    startedAt,
  } = args;

  if (!callSid) return null;

  const existing = await loadCallBySid({ supabase, clientId, callSid });
  if (existing) return existing;

  const { data, error } = await supabase
    .from("calls")
    .insert({
      client_id: clientId,
      direction: "inbound",
      from_number: fromNumber ?? null,
      to_number: toNumber ?? null,
      started_at: startedAt ?? new Date().toISOString(),
      language: language ?? "de",
      meta: {
        twilio_call_sid: callSid,
        turn_count: 0,
      },
    })
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[CALL_LOG] ensureCallLogStarted insert error", error);
    throw error;
  }

  return data;
}

export async function appendCallTurn(args: {
  supabase: SupabaseClient;
  clientId: string;
  callSid?: string | null;
  outcomeHint?: string | null;
  bookingId?: string | null;
  extraMeta?: CallMeta;
}) {
  const {
    supabase,
    clientId,
    callSid,
    outcomeHint,
    bookingId,
    extraMeta,
  } = args;

  if (!callSid) return;

  const row = await loadCallBySid({ supabase, clientId, callSid });
  if (!row?.id) return;

  const currentMeta = asObject(row.meta);
  const currentTurns = Number(currentMeta.turn_count ?? 0);
  const mergedMeta: CallMeta = {
    ...currentMeta,
    ...(extraMeta ?? {}),
    turn_count: currentTurns + 1,
  };

  if (outcomeHint) {
    mergedMeta.outcome_hint = outcomeHint;
  }

  const patch: Record<string, unknown> = {
    meta: mergedMeta,
  };

  if (bookingId) {
    patch.booking_id = bookingId;
  }

  const { error } = await supabase
    .from("calls")
    .update(patch)
    .eq("id", row.id);

  if (error) {
    console.error("[CALL_LOG] appendCallTurn update error", error);
    throw error;
  }
}

export async function finalizeCallLog(args: {
  supabase: SupabaseClient;
  clientId: string;
  callSid?: string | null;
  durationSeconds?: number | null;
  outcome?: string | null;
  extraMeta?: CallMeta;
}) {
  const { supabase, clientId, callSid, durationSeconds, outcome, extraMeta } = args;

  if (!callSid) return;

  const row = await loadCallBySid({ supabase, clientId, callSid });
  if (!row?.id) return;

  const meta = {
    ...asObject(row.meta),
    ...(extraMeta ?? {}),
  };

  const { error } = await supabase
    .from("calls")
    .update({
      duration_seconds:
        typeof durationSeconds === "number" && durationSeconds >= 0
          ? durationSeconds
          : row.duration_seconds ?? null,
      outcome: outcome ?? (meta.outcome_hint as string | null) ?? row.outcome ?? null,
      meta,
    })
    .eq("id", row.id);

  if (error) {
    console.error("[CALL_LOG] finalizeCallLog update error", error);
    throw error;
  }
}
