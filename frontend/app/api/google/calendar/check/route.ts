import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClients } from "@/lib/supabaseClients";
import { getCurrentUserId } from "@/lib/authServer";

export async function GET() {
  const supabase = createClients();
  const userId = await getCurrentUserId(supabase);
      if (!userId) {
        return NextResponse.json(
          { error: "unauthenticated" },
          { status: 401 }
        );
      }

  // DB: unsere appointments der nächsten 14 Tage
  const { data: appts, error: aErr } = await supabase
    .from("appointments")
    .select("id,title,start_at,end_at,google_event_id")
    .gte("start_at", new Date().toISOString())
    .lte("start_at", new Date(Date.now()+14*24*3600*1000).toISOString())
    .order("start_at");
  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 400 });

  // Google: Events gleicher Range
  const { data: tok } = await supabase
    .from("google_tokens").select("*").eq("user_id", userId).single();
  if (!tok) return NextResponse.json({ error: "no_tokens" }, { status: 400 });

  const oauth2 = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID!, process.env.GOOGLE_CLIENT_SECRET!);
  oauth2.setCredentials(tok);
  const calendar = google.calendar({ version: "v3", auth: oauth2 });
  const { data } = await calendar.events.list({
    calendarId: "primary",
    singleEvents: true,
    orderBy: "startTime",
    timeMin: new Date().toISOString(),
    timeMax: new Date(Date.now()+14*24*3600*1000).toISOString(),
    maxResults: 100,
  });

  const events = (data.items ?? []).map(e => ({
    id: e.id,
    summary: e.summary,
    start: e.start?.dateTime ?? e.start?.date,
    end:   e.end?.dateTime ?? e.end?.date,
  }));

  return NextResponse.json({ appts, events });
}
