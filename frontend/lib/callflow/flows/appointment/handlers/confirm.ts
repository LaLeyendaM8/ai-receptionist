import type { ConversationStateJson } from "@/lib/callflow/types";
import { parseConfirmation } from "@/lib/callflow/parsers/confirmation";
import { askToConfirm, bookingDeclined } from "@/lib/callflow/flows/appointment/questions";

type HandleConfirmArgs = {
  text: string;
  state: ConversationStateJson;
};

export type ConfirmHandlerResult = {
  reply: string;
  statePatch: ConversationStateJson;
  completed: boolean;
  confirmed?: boolean;
};

export function handleAppointmentConfirmation(
  args: HandleConfirmArgs
): ConfirmHandlerResult {
  const { text, state } = args;

  const appointment = {
    ...(state.appointment ?? {}),
  };

  const result = parseConfirmation(text);

  if (result.value === true) {
    return {
      reply: "Alles klar.",
      statePatch: {
        flow: "appointment",
        step: "confirm",
        lastIntent: "appointment_confirm",
        appointment: {
          ...appointment,
          confirmed: true,
        },
      },
      completed: true,
      confirmed: true,
    };
  }

  if (result.value === false) {
    return {
      reply: bookingDeclined(),
      statePatch: {
        flow: "appointment",
        step: "service",
        lastIntent: "create_appointment",
        appointment: {
          ...appointment,
          confirmed: false,
          serviceId: null,
          serviceName: null,
          date: null,
          time: null,
          customerName: null,
        },
      },
      completed: false,
      confirmed: false,
    };
  }

  return {
    reply: askToConfirm({
      serviceName: appointment.serviceName,
      date: appointment.date,
      time: appointment.time,
      customerName: appointment.customerName,
    }),
    statePatch: {
      flow: "appointment",
      step: "confirm",
      lastIntent: "create_appointment",
      appointment,
    },
    completed: false,
  };
}