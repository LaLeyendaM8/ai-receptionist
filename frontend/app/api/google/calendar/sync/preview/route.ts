import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getOAuth2ForUser } from "@/lib/googleServer";

export async function GET() {
  const userId = process.env.DEV_USER_ID!;
  const { oauth2, supabase } = await getOAuth2ForUser(userId);

  // DB: unsere nächsten 14 Tage
  const { data: appts } = await supabase
    .from("appointments")
    .select("id,title,start_at,end_at,google_event_id,status,source")
    .gte("start_at", new Date().toISOString())
    .lte("start_at", new Date(Date.now()+14*24*3600*1000).toISOString());

  const calendar = google.calendar({ version: "v3", auth: oauth2 });
  const { data } = await calendar.events.list({
    calendarId: "primary",
    singleEvents: true,
    orderBy: "startTime",
    timeMin: new Date().toISOString(),
    timeMax: new Date(Date.now()+14*24*3600*1000).toISOString(),
    maxResults: 100,
  });

  return NextResponse.json({
    db: appts ?? [],
    google: (data.items ?? []).map(e => ({
      id: e.id, summary: e.summary,
      start: e.start?.dateTime ?? e.start?.date,
      end:   e.end?.dateTime ?? e.end?.date,
    })),
  });
}
