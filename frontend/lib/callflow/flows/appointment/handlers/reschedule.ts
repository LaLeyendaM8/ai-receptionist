import { DateTime } from "luxon";
import type { ConversationStateJson, AppointmentState } from "@/lib/callflow/types";
import { parseName } from "@/lib/callflow/parsers/name";
import { parseDate } from "@/lib/callflow/parsers/date";
import { parseTime } from "@/lib/callflow/parsers/time";
import { parseConfirmation } from "@/lib/callflow/parsers/confirmation";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  findUpcomingAppointmentByCustomer,
  rescheduleAppointmentById,
} from "@/lib/callflow/domain/appointments/booking";
import {
  getParallelCapacity,
  checkSlotAvailability,
} from "@/lib/callflow/domain/appointments/availability";
import type { ApptInterval } from "@/lib/callflow/domain/appointments/overlap";
import { patchCalendarEventIfExists } from "@/lib/callflow/domain/appointments/calendar-sync";
import { rescheduleSuccess } from "@/lib/callflow/flows/appointment/questions";

type HandleRescheduleArgs = {
  supabase: SupabaseClient;
  clientId: string;
  ownerUserId?: string | null;
  text: string;
  timezone: string;
  state: ConversationStateJson;
};

export type RescheduleHandlerResult = {
  reply: string;
  statePatch: ConversationStateJson;
  completed: boolean;
};

function askRescheduleDate() {
  return "Auf welchen Tag möchten Sie den Termin verschieben?";
}

function askRescheduleTime(date?: string | null) {
  return date
    ? `Welche Uhrzeit passt Ihnen am ${date}?`
    : "Welche neue Uhrzeit passt Ihnen?";
}

function askRescheduleName() {
  return "Auf welchen Namen läuft der bisherige Termin?";
}

function askRescheduleConfirm(args: {
  date?: string | null;
  time?: string | null;
  customerName?: string | null;
}) {
  const parts = [
    args.date ? `auf ${args.date}` : null,
    args.time ? `um ${args.time}` : null,
    args.customerName ? `für ${args.customerName}` : null,
  ].filter(Boolean);

  return `Ich habe die Verschiebung ${parts.join(" ")} vorgemerkt. Soll ich das so bestätigen?`;
}

function toUTCSlot(args: {
  date: string;
  time: string;
  timezone: string;
  durationMin: number;
}) {
  const local = DateTime.fromISO(`${args.date}T${args.time}:00`, {
    zone: args.timezone,
  });

  if (!local.isValid) return null;

  const startAt = local.toUTC().toISO({ suppressMilliseconds: true });
  const endAt = local.plus({ minutes: args.durationMin }).toUTC().toISO({
    suppressMilliseconds: true,
  });

  if (!startAt || !endAt) return null;
  return { startAt, endAt };
}

export async function handleRescheduleAppointment(
  args: HandleRescheduleArgs
): Promise<RescheduleHandlerResult> {
  const { supabase, clientId, ownerUserId, text, timezone, state } = args;

  const appointment: AppointmentState = {
    ...(state.appointment ?? {}),
    mode: "reschedule",
  };

  if (!appointment.customerName) {
    const nameResult = parseName(text);

    if (!nameResult.value) {
      return {
        reply: askRescheduleName(),
        statePatch: {
          flow: "appointment",
          step: "name",
          lastIntent: "reschedule_appointment",
          appointment,
        },
        completed: false,
      };
    }

    appointment.customerName = nameResult.value;
  }

  if (!appointment.date) {
    const dateResult = parseDate(text, timezone);

    if (!dateResult.value) {
      return {
        reply: askRescheduleDate(),
        statePatch: {
          flow: "appointment",
          step: "date",
          lastIntent: "reschedule_appointment",
          appointment,
        },
        completed: false,
      };
    }

    appointment.date = dateResult.value;
  }

  if (!appointment.time) {
    const timeResult = parseTime(text);

    if (!timeResult.value) {
      return {
        reply: askRescheduleTime(appointment.date),
        statePatch: {
          flow: "appointment",
          step: "time",
          lastIntent: "reschedule_appointment",
          appointment,
        },
        completed: false,
      };
    }

    appointment.time = timeResult.value;
  }

  const confirmation = parseConfirmation(text);

  if (confirmation.value === false) {
    return {
      reply: "Alles klar, dann ändere ich den Termin nicht.",
      statePatch: {
        flow: "idle",
        step: "done",
        lastIntent: "reschedule_appointment",
        appointment: {
          ...appointment,
          confirmed: false,
        },
      },
      completed: true,
    };
  }

  if (confirmation.value !== true) {
    return {
      reply: askRescheduleConfirm({
        date: appointment.date,
        time: appointment.time,
        customerName: appointment.customerName,
      }),
      statePatch: {
        flow: "appointment",
        step: "confirm",
        lastIntent: "reschedule_appointment",
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
      reply: "Ich konnte leider keinen passenden Termin zum Verschieben finden.",
      statePatch: {
        flow: "idle",
        step: "done",
        lastIntent: "reschedule_appointment",
        appointment,
      },
      completed: true,
    };
  }

  const oldDurationMin = Math.max(
    15,
    Math.round(
      (new Date(found.end_at).getTime() - new Date(found.start_at).getTime()) / 60000
    )
  );

  const slot = toUTCSlot({
    date: appointment.date!,
    time: appointment.time!,
    timezone,
    durationMin: oldDurationMin,
  });

  if (!slot) {
    return {
      reply: askRescheduleTime(appointment.date),
      statePatch: {
        flow: "appointment",
        step: "time",
        lastIntent: "reschedule_appointment",
        appointment,
      },
      completed: false,
    };
  }

  const overlapCache = new Map<string, ApptInterval[]>();
  const capacity = await getParallelCapacity(supabase, clientId);

  const availability = await checkSlotAvailability({
    supabase,
    overlapCache,
    clientId,
    startISO: slot.startAt,
    endISO: slot.endAt,
    tz: timezone,
    staffId: found.staff_id ?? null,
    capacity,
  });

  if (!availability.ok) {
    return {
      reply: "Die gewünschte neue Zeit ist leider nicht frei. Bitte nennen Sie eine andere Uhrzeit.",
      statePatch: {
        flow: "appointment",
        step: "time",
        lastIntent: "reschedule_appointment",
        appointment: {
          ...appointment,
          confirmed: false,
          time: null,
        },
      },
      completed: false,
    };
  }

  const updated = await rescheduleAppointmentById({
    supabase,
    appointmentId: found.id,
    startAt: slot.startAt,
    endAt: slot.endAt,
  });

  if (ownerUserId && found.google_event_id) {
    await patchCalendarEventIfExists({
      ownerUserId,
      googleEventId: found.google_event_id,
      startAt: slot.startAt,
      endAt: slot.endAt,
      timezone,
    });
  }

  return {
    reply: rescheduleSuccess({
      date: appointment.date,
      time: appointment.time,
    }),
    statePatch: {
      flow: "idle",
      step: "done",
      lastIntent: "reschedule_appointment",
      appointment: {
        ...appointment,
        confirmed: true,
        staffId: updated.staff_id ?? appointment.staffId ?? null,
      },
    },
    completed: true,
  };
}