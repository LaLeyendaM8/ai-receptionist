import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getOAuth2ForUser } from "@/lib/googleServer";
import { getCurrentUserId } from "@/lib/authServer";
import { createClients } from "@/lib/supabaseClients";

export async function POST() {
  const supabase = createClients();
      const userId = await getCurrentUserId(supabase);
          if (!userId) {
            return NextResponse.json(
              { error: "unauthenticated" },
              { status: 401 }
            );
          }
  const { oauth2 } = await getOAuth2ForUser(userId);
  const calendar = google.calendar({ version: "v3", auth: oauth2 });

  const { data } = await calendar.events.list({
    calendarId: "primary",
    singleEvents: true,
    orderBy: "startTime",
    timeMin: new Date().toISOString(),
    timeMax: new Date(Date.now()+14*24*3600*1000).toISOString(),
    maxResults: 100,
  });

  const items = (data.items ?? []).filter(e => e.id && e.start?.dateTime && e.end?.dateTime);

  const results: any[] = [];
  for (const ev of items) {
    const startISO = ev.start!.dateTime!;
    const endISO   = ev.end!.dateTime!;
    const title    = ev.summary ?? "Termin";

    // upsert nach google_event_id
    const { error } = await supabase.from("appointments").upsert({
      google_event_id: ev.id!,
      title,
      notes: ev.description ?? null,
      start_at: new Date(startISO).toISOString(),
      end_at:   new Date(endISO).toISOString(),
      status: "booked",
      source: "google",
      // client_id: null  // falls required, setze hier einen Default-Client
    }, { onConflict: "google_event_id" });

    results.push({ eventId: ev.id, ok: !error, err: error?.message });
  }

  return NextResponse.json({ ok: true, results });
}
