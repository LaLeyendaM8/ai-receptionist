import { DateTime } from "luxon";
import type { ConversationStateJson, AppointmentState } from "@/lib/callflow/types";
import { parseName } from "@/lib/callflow/parsers/name";
import { parseDate } from "@/lib/callflow/parsers/date";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findUpcomingAppointmentByCustomer } from "@/lib/callflow/domain/appointments/booking";
import {
  appointmentInfoAnswer,
  appointmentInfoNotFound,
} from "@/lib/callflow/flows/appointment/questions";

type HandleAppointmentInfoArgs = {
  supabase: SupabaseClient;
  clientId: string;
  text: string;
  timezone: string;
  state: ConversationStateJson;
};

export type AppointmentInfoHandlerResult = {
  reply: string;
  statePatch: ConversationStateJson;
  completed: boolean;
};

function localDateAndTime(iso: string, timezone: string) {
  const dt = DateTime.fromISO(iso, { zone: "utc" }).setZone(timezone);
  return {
    date: dt.toFormat("yyyy-MM-dd"),
    time: dt.toFormat("HH:mm"),
  };
}

export async function handleAppointmentInfo(
  args: HandleAppointmentInfoArgs
): Promise<AppointmentInfoHandlerResult> {
  const { supabase, clientId, text, timezone, state } = args;

  const appointment: AppointmentState = {
    ...(state.appointment ?? {}),
    mode: "info",
  };

  if (!appointment.customerName) {
    const nameResult = parseName(text);
    if (nameResult.value) appointment.customerName = nameResult.value;
  }

  if (!appointment.date) {
    const dateResult = parseDate(text, timezone);
    if (dateResult.value) appointment.date = dateResult.value;
  }

  if (!appointment.customerName) {
    return {
      reply: "Auf welchen Namen wurde der Termin gebucht?",
      statePatch: {
        flow: "appointment",
        step: "name",
        lastIntent: "appointment_info",
        appointment,
      },
      completed: false,
    };
  }

  const found = await findUpcomingAppointmentByCustomer({
    supabase,
    clientId,
    customerName: appointment.customerName,
    customerPhone: appointment.phone ?? null,
  });

  if (!found) {
    return {
      reply: appointmentInfoNotFound(),
      statePatch: {
        flow: "idle",
        step: "done",
        lastIntent: "appointment_info",
        appointment,
      },
      completed: true,
    };
  }

  const local = localDateAndTime(found.start_at, timezone);

  return {
    reply: appointmentInfoAnswer({
      title: found.title ?? null,
      date: local.date,
      time: local.time,
    }),
    statePatch: {
      flow: "idle",
      step: "done",
      lastIntent: "appointment_info",
      appointment: {
        ...appointment,
        date: local.date,
        time: local.time,
      },
    },
    completed: true,
  };
}