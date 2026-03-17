import type { SupabaseClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { getOAuth2ForUser } from "@/lib/google/googleServer";
import { setAppointmentGoogleEventId } from "@/lib/callflow/domain/appointments/booking";

export type CalendarSyncResult = {
  synced: boolean;
  externalEventId?: string | null;
  error?: string | null;
};

export async function insertCalendarEventForAppointment(args: {
  supabase: SupabaseClient;
  ownerUserId: string;
  appointment: {
    id: string;
    title?: string | null;
    start_at: string;
    end_at: string;
  };
  timezone: string;
}): Promise<CalendarSyncResult> {
  const { supabase, ownerUserId, appointment, timezone } = args;

  try {
    const { oauth2 } = await getOAuth2ForUser(ownerUserId);
    const calendar = google.calendar({ version: "v3", auth: oauth2 });

    const ins = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: appointment.title ?? "Termin",
        description: "Erstellt durch ReceptaAI",
        start: { dateTime: appointment.start_at, timeZone: timezone },
        end: { dateTime: appointment.end_at, timeZone: timezone },
      },
    });

    if (ins.data.id) {
      await setAppointmentGoogleEventId({
        supabase,
        appointmentId: appointment.id,
        googleEventId: ins.data.id,
      });

      return {
        synced: true,
        externalEventId: ins.data.id,
        error: null,
      };
    }

    return {
      synced: false,
      externalEventId: null,
      error: null,
    };
  } catch (error) {
    console.error("[CALENDAR_SYNC] insert error", error);
    return {
      synced: false,
      externalEventId: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function deleteCalendarEventIfExists(args: {
  ownerUserId: string;
  googleEventId?: string | null;
}) {
  const { ownerUserId, googleEventId } = args;

  if (!googleEventId) return { success: true as const };

  try {
    const { oauth2 } = await getOAuth2ForUser(ownerUserId);
    const calendar = google.calendar({ version: "v3", auth: oauth2 });

    await calendar.events.delete({
      calendarId: "primary",
      eventId: googleEventId,
    });

    return { success: true as const };
  } catch (error) {
    console.error("[CALENDAR_SYNC] delete error", error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function patchCalendarEventIfExists(args: {
  ownerUserId: string;
  googleEventId?: string | null;
  startAt: string;
  endAt: string;
  timezone: string;
}) {
  const { ownerUserId, googleEventId, startAt, endAt, timezone } = args;

  if (!googleEventId) return { success: true as const };

  try {
    const { oauth2 } = await getOAuth2ForUser(ownerUserId);
    const calendar = google.calendar({ version: "v3", auth: oauth2 });

    await calendar.events.patch({
      calendarId: "primary",
      eventId: googleEventId,
      requestBody: {
        start: { dateTime: startAt, timeZone: timezone },
        end: { dateTime: endAt, timeZone: timezone },
      },
    });

    return { success: true as const };
  } catch (error) {
    console.error("[CALENDAR_SYNC] patch error", error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}