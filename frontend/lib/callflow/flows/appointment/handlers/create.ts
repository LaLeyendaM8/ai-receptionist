import type { SupabaseClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
import type { AppointmentState, ConversationStateJson } from "@/lib/callflow/types";
import { parseConfirmation } from "@/lib/callflow/parsers/confirmation";
import { parseDate } from "@/lib/callflow/parsers/date";
import { parseName } from "@/lib/callflow/parsers/name";
import { parsePhone } from "@/lib/callflow/parsers/phone";
import { parseService, type ServiceCandidate } from "@/lib/callflow/parsers/service";
import { parseTime } from "@/lib/callflow/parsers/time";
import {
  getCurrentAppointmentStep,
  patchAppointmentState,
} from "@/lib/callflow/flows/appointment/state-machine";
import {
  askForClarifiedDate,
  askForClarifiedName,
  askForClarifiedService,
  askForClarifiedTime,
  askForDate,
  askForName,
  askForService,
  askForTime,
  askToConfirm,
  bookingConfirmed,
  bookingDeclined,
} from "@/lib/callflow/flows/appointment/questions";
import {
  getParallelCapacity,
  checkSlotAvailability,
} from "@/lib/callflow/domain/appointments/availability";
import type { ApptInterval } from "@/lib/callflow/domain/appointments/overlap";
import {
  createAppointmentDraft,
  loadAppointmentDraft,
  createAppointmentFromDraft,
  deleteAppointmentDraft,
  setAppointmentGoogleEventId,
} from "@/lib/callflow/domain/appointments/booking";
import { insertCalendarEventForAppointment } from "@/lib/callflow/domain/appointments/calendar-sync";
import { notifyAppointmentCreated } from "@/lib/callflow/domain/appointments/notifications";

type HandleCreateAppointmentArgs = {
  supabase: SupabaseClient;
  clientId: string;
  timezone: string;
  text: string;
  state: ConversationStateJson;
  ownerUserId?: string | null;
};

export type AppointmentCreateHandlerResult = {
  reply: string;
  statePatch: ConversationStateJson;
  completed: boolean;
};

async function loadClientServices(
  supabase: SupabaseClient,
  clientId: string
): Promise<ServiceCandidate[]> {
  const { data, error } = await supabase
    .from("services")
    .select("id, title, duration_min, price_cents")
    .eq("client_id", clientId)
    .eq("active", true);

  if (error) {
    console.error("[APPOINTMENT_CREATE] load services error", error);
    return [];
  }

  return (data ?? []) as ServiceCandidate[];
}

function toUTCSlot(args: {
  date: string;
  time: string;
  timezone: string;
  durationMin: number;
}) {
  const { date, time, timezone, durationMin } = args;

  const local = DateTime.fromISO(`${date}T${time}:00`, { zone: timezone });
  if (!local.isValid) return null;

  const startAt = local.toUTC().toISO({ suppressMilliseconds: true });
  const endAt = local.plus({ minutes: durationMin }).toUTC().toISO({ suppressMilliseconds: true });

  if (!startAt || !endAt) return null;

  return { startAt, endAt };
}

export async function handleCreateAppointment(
  args: HandleCreateAppointmentArgs
): Promise<AppointmentCreateHandlerResult> {
  const { supabase, clientId, timezone, text, state, ownerUserId } = args;

  const currentAppointment: AppointmentState = {
    ...(state.appointment ?? {}),
    mode: "booking",
  };

  const services = await loadClientServices(supabase, clientId);
  const step = getCurrentAppointmentStep(currentAppointment);

  if (step === "service") {
    const serviceResult = parseService({
      text,
      services,
    });

    if (!serviceResult.value) {
      return {
        reply: !text.trim() ? askForService() : askForClarifiedService(services),
        statePatch: {
          flow: "appointment",
          step: "service",
          lastIntent: "create_appointment",
          appointment: currentAppointment,
        },
        completed: false,
      };
    }

    const nextAppointment = patchAppointmentState(currentAppointment, {
      serviceId: serviceResult.value.id,
      serviceName: serviceResult.value.title,
      confirmed: false,
    });

    return {
      reply: askForDate(nextAppointment.serviceName),
      statePatch: {
        flow: "appointment",
        step: "date",
        lastIntent: "create_appointment",
        appointment: nextAppointment,
      },
      completed: false,
    };
  }

  if (step === "date") {
    const dateResult = parseDate(text, timezone);

    if (!dateResult.value) {
      return {
        reply: !text.trim() ? askForDate(currentAppointment.serviceName) : askForClarifiedDate(),
        statePatch: {
          flow: "appointment",
          step: "date",
          lastIntent: "create_appointment",
          appointment: currentAppointment,
        },
        completed: false,
      };
    }

    const nextAppointment = patchAppointmentState(currentAppointment, {
      date: dateResult.value,
      confirmed: false,
    });

    return {
      reply: askForTime(nextAppointment.date),
      statePatch: {
        flow: "appointment",
        step: "time",
        lastIntent: "create_appointment",
        appointment: nextAppointment,
      },
      completed: false,
    };
  }

  if (step === "time") {
    const timeResult = parseTime(text);

    if (!timeResult.value) {
      return {
        reply: !text.trim() ? askForTime(currentAppointment.date) : askForClarifiedTime(),
        statePatch: {
          flow: "appointment",
          step: "time",
          lastIntent: "create_appointment",
          appointment: currentAppointment,
        },
        completed: false,
      };
    }

    const nextAppointment = patchAppointmentState(currentAppointment, {
      time: timeResult.value,
      confirmed: false,
    });

    return {
      reply: askForName(),
      statePatch: {
        flow: "appointment",
        step: "name",
        lastIntent: "create_appointment",
        appointment: nextAppointment,
      },
      completed: false,
    };
  }

  if (step === "name") {
    const nameResult = parseName(text);

    if (!nameResult.value) {
      return {
        reply: !text.trim() ? askForName() : askForClarifiedName(),
        statePatch: {
          flow: "appointment",
          step: "name",
          lastIntent: "create_appointment",
          appointment: currentAppointment,
        },
        completed: false,
      };
    }

    const nextAppointment = patchAppointmentState(currentAppointment, {
      customerName: nameResult.value,
      confirmed: false,
    });

    return {
      reply: askToConfirm({
        serviceName: nextAppointment.serviceName,
        date: nextAppointment.date,
        time: nextAppointment.time,
        customerName: nextAppointment.customerName,
      }),
      statePatch: {
        flow: "appointment",
        step: "confirm",
        lastIntent: "create_appointment",
        appointment: nextAppointment,
      },
      completed: false,
    };
  }

  if (step === "confirm") {
    const confirmation = parseConfirmation(text);

    if (confirmation.value === false) {
      const nextAppointment = patchAppointmentState(currentAppointment, {
        confirmed: false,
      });

      return {
        reply: bookingDeclined(),
        statePatch: {
          flow: "appointment",
          step: "service",
          lastIntent: "create_appointment",
          appointment: {
            ...nextAppointment,
            serviceId: null,
            serviceName: null,
            date: null,
            time: null,
            customerName: null,
          },
        },
        completed: false,
      };
    }

    if (confirmation.value !== true) {
      return {
        reply: askToConfirm({
          serviceName: currentAppointment.serviceName,
          date: currentAppointment.date,
          time: currentAppointment.time,
          customerName: currentAppointment.customerName,
        }),
        statePatch: {
          flow: "appointment",
          step: "confirm",
          lastIntent: "create_appointment",
          appointment: currentAppointment,
        },
        completed: false,
      };
    }

    if (
      !currentAppointment.serviceId ||
      !currentAppointment.serviceName ||
      !currentAppointment.date ||
      !currentAppointment.time ||
      !currentAppointment.customerName
    ) {
      return {
        reply: "Entschuldigung, mir fehlen noch ein paar Angaben. Lassen Sie uns den Termin noch einmal kurz durchgehen.",
        statePatch: {
          flow: "appointment",
          step: "service",
          lastIntent: "create_appointment",
          appointment: {
            mode: "booking",
            confirmed: false,
          },
        },
        completed: false,
      };
    }

    const matchedService = services.find((s) => s.id === currentAppointment.serviceId);
    const durationMin = Number(matchedService?.duration_minutes ?? 30);
    const slot = toUTCSlot({
      date: currentAppointment.date,
      time: currentAppointment.time,
      timezone,
      durationMin,
    });

    if (!slot) {
      return {
        reply: askForClarifiedTime(),
        statePatch: {
          flow: "appointment",
          step: "time",
          lastIntent: "create_appointment",
          appointment: currentAppointment,
        },
        completed: false,
      };
    }

    const capacity = await getParallelCapacity(supabase, clientId);
    const overlapCache = new Map<string, ApptInterval[]>();

    const availability = await checkSlotAvailability({
      supabase,
      overlapCache,
      clientId,
      startISO: slot.startAt,
      endISO: slot.endAt,
      tz: timezone,
      staffId: currentAppointment.staffId ?? null,
      capacity,
    });

    if (!availability.ok) {
      return {
        reply: "Dieser Termin ist leider nicht mehr frei. Möchten Sie eine andere Uhrzeit nennen?",
        statePatch: {
          flow: "appointment",
          step: "time",
          lastIntent: "create_appointment",
          appointment: {
            ...currentAppointment,
            confirmed: false,
            time: null,
          },
        },
        completed: false,
      };
    }

    const draft = await createAppointmentDraft({
      supabase,
      clientId,
      title: currentAppointment.serviceName,
      startAt: slot.startAt,
      endAt: slot.endAt,
      customerName: currentAppointment.customerName,
      customerPhone: currentAppointment.phone ?? null,
      notes: "",
      staffId: currentAppointment.staffId ?? null,
    });

    const loadedDraft = await loadAppointmentDraft({
      supabase,
      clientId,
      draftId: draft?.id ?? null,
    });

    if (!loadedDraft) {
      return {
        reply: "Entschuldigung, der Termin konnte gerade nicht vorbereitet werden.",
        statePatch: {
          flow: "appointment",
          step: "confirm",
          lastIntent: "create_appointment",
          appointment: currentAppointment,
        },
        completed: false,
      };
    }

    const appointment = await createAppointmentFromDraft({
      supabase,
      clientId,
      draft: loadedDraft,
    });

    if (loadedDraft.id) {
      await deleteAppointmentDraft(supabase, loadedDraft.id);
    }

    if (ownerUserId) {
      const syncResult = await insertCalendarEventForAppointment({
        supabase,
        ownerUserId,
        appointment: {
          id: appointment.id,
          title: appointment.title,
          start_at: appointment.start_at,
          end_at: appointment.end_at,
        },
        timezone,
      });

      if (syncResult.synced && syncResult.externalEventId) {
        await setAppointmentGoogleEventId({
          supabase,
          appointmentId: appointment.id,
          googleEventId: syncResult.externalEventId,
        });
      }
    }

    await notifyAppointmentCreated({
      supabase,
      clientId,
      appointment: {
        title: appointment.title,
        start_at: appointment.start_at,
        customer_name: appointment.customer_name,
        customer_phone: appointment.customer_phone,
        staff_id: appointment.staff_id,
      },
      timezone,
    });

    return {
      reply: bookingConfirmed({
        serviceName: currentAppointment.serviceName,
        date: currentAppointment.date,
        time: currentAppointment.time,
      }),
      statePatch: {
        flow: "idle",
        step: "done",
        lastIntent: "appointment_confirm",
        appointment: {
          ...currentAppointment,
          confirmed: true,
          draftId: null,
        },
      },
      completed: true,
    };
  }

  return {
    reply: askForService(),
    statePatch: {
      flow: "appointment",
      step: "service",
      lastIntent: "create_appointment",
      appointment: currentAppointment,
    },
    completed: false,
  };
}