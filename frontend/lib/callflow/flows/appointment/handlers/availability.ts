import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConversationStateJson, AppointmentState } from "@/lib/callflow/types";
import { parseDate } from "@/lib/callflow/parsers/date";
import { parseService, type ServiceCandidate } from "@/lib/callflow/parsers/service";
import {
  askAvailabilityMissingDate,
  askAvailabilityMissingService,
  availabilityAnswer,
} from "@/lib/callflow/flows/appointment/questions";
import {
  findNextFreeSlots,
  getParallelCapacity,
} from "@/lib/callflow/domain/appointments/availability";
import type { ApptInterval } from "@/lib/callflow/domain/appointments/overlap";

type HandleAvailabilityArgs = {
  supabase: SupabaseClient;
  clientId: string;
  timezone: string;
  text: string;
  state: ConversationStateJson;
};

export type AvailabilityHandlerResult = {
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
    .select("id, name, duration_minutes, price")
    .eq("client_id", clientId)
    .eq("active", true);

  if (error) {
    console.error("[APPOINTMENT_AVAILABILITY] load services error", error);
    return [];
  }

  return (data ?? []) as ServiceCandidate[];
}

export async function handleAvailabilityAppointment(
  args: HandleAvailabilityArgs
): Promise<AvailabilityHandlerResult> {
  const { supabase, clientId, timezone, text, state } = args;

  const appointment: AppointmentState = {
    ...(state.appointment ?? {}),
    mode: "availability",
  };

  const services = await loadClientServices(supabase, clientId);

  if (!appointment.serviceId && !appointment.serviceName) {
    const serviceResult = parseService({ text, services });

    if (serviceResult.value) {
      appointment.serviceId = serviceResult.value.id;
      appointment.serviceName = serviceResult.value.name;
    }
  }

  if (!appointment.date) {
    const dateResult = parseDate(text, timezone);

    if (dateResult.value) {
      appointment.date = dateResult.value;
    }
  }

  if (!appointment.serviceName) {
    return {
      reply: askAvailabilityMissingService(),
      statePatch: {
        flow: "appointment",
        step: "service",
        lastIntent: "availability",
        appointment,
      },
      completed: false,
    };
  }

  if (!appointment.date) {
    return {
      reply: askAvailabilityMissingDate(),
      statePatch: {
        flow: "appointment",
        step: "date",
        lastIntent: "availability",
        appointment,
      },
      completed: false,
    };
  }

  const matchedService = services.find((s) => s.id === appointment.serviceId);
  const durationMin = Number(matchedService?.duration_minutes ?? 30);
  const capacity = await getParallelCapacity(supabase, clientId);
  const overlapCache = new Map<string, ApptInterval[]>();

  const suggestions = await findNextFreeSlots({
    supabase,
    overlapCache,
    clientId,
    staffId: appointment.staffId ?? null,
    day: new Date(`${appointment.date}T12:00:00`),
    durationMin,
    tz: timezone,
    maxSuggestions: 3,
    capacity,
  });

  return {
    reply: availabilityAnswer({
      serviceName: appointment.serviceName,
      date: appointment.date,
      suggestions,
    }),
    statePatch: {
      flow: "idle",
      step: "done",
      lastIntent: "availability",
      appointment: {
        ...appointment,
        confirmed: false,
      },
    },
    completed: true,
  };
}