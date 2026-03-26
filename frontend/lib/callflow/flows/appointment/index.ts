import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConversationStateJson } from "@/lib/callflow/types";
import { handleAvailabilityAppointment } from "@/lib/callflow/flows/appointment/handlers/availability";
import { handleCreateAppointment } from "@/lib/callflow/flows/appointment/handlers/create";
import { handleCancelAppointment } from "@/lib/callflow/flows/appointment/handlers/cancel";
import { handleRescheduleAppointment } from "@/lib/callflow/flows/appointment/handlers/reschedule";
import { handleAppointmentInfo } from "@/lib/callflow/flows/appointment/handlers/info";

export type AppointmentFlowResult = {
  reply: string;
  statePatch: ConversationStateJson;
  useLegacy: boolean;
  appointmentId?: string;
  legacyIntent?:
    | "create_appointment"
    | "availability"
    | "appointment_confirm"
    | "cancel_appointment"
    | "reschedule_appointment"
    | "appointment_info";
};

type HandleAppointmentFlowArgs = {
  supabase: SupabaseClient;
  clientId: string;
  timezone: string;
  text: string;
  state: ConversationStateJson;
  ownerUserId?: string | null;
  fromNumber?: string | null;
};

function normalize(text: string) {
  return (text || "").trim().toLowerCase();
}

function looksLikeAvailabilityIntent(text: string) {
  const t = normalize(text);
  return [
    "frei",
    "verfügbar",
    "verfuegbar",
    "wann habt ihr was frei",
    "wann haben sie was frei",
    "wann wäre etwas frei",
    "wann ist etwas frei",
    "habt ihr noch termine",
    "haben sie noch termine",
  ].some((p) => t.includes(p));
}

function looksLikeCancelIntent(text: string) {
  const t = normalize(text);
  return ["absagen", "stornieren", "löschen", "canceln"].some((p) => t.includes(p));
}

function looksLikeRescheduleIntent(text: string) {
  const t = normalize(text);
  return ["verschieben", "verlegen", "ändern", "aendern", "umlegen"].some((p) =>
    t.includes(p)
  );
}

function looksLikeInfoIntent(text: string) {
  const t = normalize(text);
  return [
    "welchen termin",
    "habe ich einen termin",
    "habe ich schon einen termin",
    "termin prüfen",
    "termin checken",
    "termin nachschauen",
  ].some((p) => t.includes(p));
}

export async function handleAppointmentFlow(
  args: HandleAppointmentFlowArgs
): Promise<AppointmentFlowResult> {
  const { supabase, clientId, timezone, text, state, ownerUserId, fromNumber } = args;

  const lastIntent = state.lastIntent;
  const currentStep = state.step;
  const appointment = state.appointment ?? {};

  if (lastIntent === "cancel_appointment" || appointment.mode === "cancel" || looksLikeCancelIntent(text)) {
    const result = await handleCancelAppointment({
      supabase,
      clientId,
      ownerUserId,
      text,
      timezone,
      state,
    });

    return {
      reply: result.reply,
      statePatch: result.statePatch,
      useLegacy: false,
    };
  }

  if (
    lastIntent === "reschedule_appointment" ||
    appointment.mode === "reschedule" ||
    looksLikeRescheduleIntent(text)
  ) {
    const result = await handleRescheduleAppointment({
      supabase,
      clientId,
      ownerUserId,
      text,
      timezone,
      state,
    });

    return {
      reply: result.reply,
      statePatch: result.statePatch,
      useLegacy: false,
    };
  }

  if (lastIntent === "appointment_info" || looksLikeInfoIntent(text)) {
    const result = await handleAppointmentInfo({
      supabase,
      clientId,
      text,
      timezone,
      state,
    });

    return {
      reply: result.reply,
      statePatch: result.statePatch,
      useLegacy: false,
    };
  }

  if (
    lastIntent === "availability" ||
    appointment.mode === "availability" ||
    looksLikeAvailabilityIntent(text)
  ) {
    const result = await handleAvailabilityAppointment({
      supabase,
      clientId,
      timezone,
      text,
      state,
    });

    return {
      reply: result.reply,
      statePatch: result.statePatch,
      useLegacy: false,
    };
  }

  const result = await handleCreateAppointment({
    supabase,
    clientId,
    timezone,
    text,
    state,
    ownerUserId,
    callerPhone: fromNumber,
  });

  return {
    reply: result.reply,
    statePatch: result.statePatch,
    useLegacy: false,
    appointmentId: result.appointmentId,
  };
}
