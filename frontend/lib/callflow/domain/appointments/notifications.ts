import type { SupabaseClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
import { notifyNewAppointment } from "@/lib/notify/notifyNewAppointment";

export async function notifyAppointmentCreated(args: {
  supabase: SupabaseClient;
  clientId: string;
  appointment: {
    title?: string | null;
    start_at: string;
    customer_name?: string | null;
    customer_phone?: string | null;
    staff_id?: string | null;
  };
  timezone: string;
}) {
  const { supabase, clientId, appointment, timezone } = args;

  try {
    const { data: clientRow } = await supabase
      .from("clients")
      .select("notification_email")
      .eq("id", clientId)
      .maybeSingle();

    if (!clientRow?.notification_email) {
      return { success: true as const, skipped: true as const };
    }

    const localStart = DateTime.fromISO(appointment.start_at, { zone: "utc" })
      .setZone(timezone)
      .setLocale("de");

    const date = localStart.toFormat("dd.LL.yyyy");
    const time = localStart.toFormat("HH:mm");

    let staffLabel: string | null = null;

    if (appointment.staff_id) {
      const { data: staffRow } = await supabase
        .from("staff")
        .select("name")
        .eq("id", appointment.staff_id)
        .maybeSingle();

      staffLabel = staffRow?.name ?? null;
    }

    await notifyNewAppointment({
      to: clientRow.notification_email,
      service: appointment.title ?? "Termin",
      date,
      time,
      customerName: appointment.customer_name ?? null,
      phone: appointment.customer_phone ?? null,
      staff: staffLabel,
    });

    return { success: true as const };
  } catch (error) {
    console.error("[APPOINTMENT_NOTIFY] error", error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}