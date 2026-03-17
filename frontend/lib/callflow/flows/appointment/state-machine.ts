import type { AppointmentState } from "@/lib/callflow/types";

export type AppointmentFlowMode = "booking" | "availability" | "confirm";
export type AppointmentFlowStep =
  | "service"
  | "date"
  | "time"
  | "name"
  | "confirm"
  | "done";

export function getCurrentAppointmentStep(
  appointment?: AppointmentState | null
): AppointmentFlowStep {
  if (!appointment?.serviceName && !appointment?.serviceId) return "service";
  if (!appointment?.date) return "date";
  if (!appointment?.time) return "time";
  if (!appointment?.customerName) return "name";
  if (!appointment?.confirmed) return "confirm";
  return "done";
}

export function patchAppointmentState(
  current: AppointmentState | null | undefined,
  patch: Partial<AppointmentState>
): AppointmentState {
  return {
    ...(current ?? {}),
    ...patch,
  };
}

export function resetAppointmentForRestart(
  current?: AppointmentState | null
): AppointmentState {
  return {
    mode: current?.mode ?? "booking",
    draftId: null,
    date: null,
    time: null,
    serviceId: null,
    serviceName: null,
    staffId: null,
    staffName: null,
    customerName: null,
    phone: current?.phone ?? null,
    confirmed: false,
  };
}