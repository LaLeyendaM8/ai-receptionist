import type { ConversationStateJson, AppointmentState } from "@/lib/callflow/types";
import { parseName } from "@/lib/callflow/parsers/name";
import { parseConfirmation } from "@/lib/callflow/parsers/confirmation";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  findUpcomingAppointmentByCustomer,
  cancelAppointmentById,
} from "@/lib/callflow/domain/appointments/booking";
import { deleteCalendarEventIfExists } from "@/lib/callflow/domain/appointments/calendar-sync";
import { cancelNotFound, cancelSuccess } from "@/lib/callflow/flows/appointment/questions";

type HandleCancelArgs = {
  supabase: SupabaseClient;
  clientId: string;
  ownerUserId?: string | null;
  text: string;
  timezone: string;
  state: ConversationStateJson;
};

export type CancelHandlerResult = {
  reply: string;
  statePatch: ConversationStateJson;
  completed: boolean;
};

function askCancelName() {
  return "Auf welchen Namen wurde der Termin gebucht?";
}

function askCancelConfirm(args: {
  customerName?: string | null;
}) {
  return `Ich habe die Terminabsage${args.customerName ? ` auf den Namen ${args.customerName}` : ""} vorgemerkt. Soll ich das so bestätigen?`;
}

export async function handleCancelAppointment(
  args: HandleCancelArgs
): Promise<CancelHandlerResult> {
  const { supabase, clientId, ownerUserId, text, state } = args;

  const appointment: AppointmentState = {
    ...(state.appointment ?? {}),
    mode: "cancel",
  };

  if (!appointment.customerName) {
    const nameResult = parseName(text);

    if (!nameResult.value) {
      return {
        reply: askCancelName(),
        statePatch: {
          flow: "appointment",
          step: "name",
          lastIntent: "cancel_appointment",
          appointment,
        },
        completed: false,
      };
    }

    appointment.customerName = nameResult.value;
  }

  const confirmation = parseConfirmation(text);

  if (confirmation.value === false) {
    return {
      reply: "Alles klar, dann nehme ich keine Absage vor.",
      statePatch: {
        flow: "idle",
        step: "done",
        lastIntent: "cancel_appointment",
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
      reply: askCancelConfirm({
        customerName: appointment.customerName,
      }),
      statePatch: {
        flow: "appointment",
        step: "confirm",
        lastIntent: "cancel_appointment",
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
      reply: cancelNotFound(),
      statePatch: {
        flow: "idle",
        step: "done",
        lastIntent: "cancel_appointment",
        appointment,
      },
      completed: true,
    };
  }

  await cancelAppointmentById(supabase, found.id);

  if (ownerUserId && found.google_event_id) {
    await deleteCalendarEventIfExists({
      ownerUserId,
      googleEventId: found.google_event_id,
    });
  }

  return {
    reply: cancelSuccess({}),
    statePatch: {
      flow: "idle",
      step: "done",
      lastIntent: "cancel_appointment",
      appointment: {
        ...appointment,
        confirmed: true,
      },
    },
    completed: true,
  };
}