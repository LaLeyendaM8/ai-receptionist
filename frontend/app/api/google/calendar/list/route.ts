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
  const { data: tok, error } = await supabase
    .from("google_tokens").select("*").eq("user_id", userId).single();
  if (error || !tok) return NextResponse.json({ error: "no_tokens" }, { status: 400 });

  const oauth2 = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID!, process.env.GOOGLE_CLIENT_SECRET!);
  oauth2.setCredentials(tok);

  const calendar = google.calendar({ version: "v3", auth: oauth2 });
  const { data } = await calendar.events.list({
    calendarId: "primary",
    singleEvents: true,
    orderBy: "startTime",
    timeMin: new Date(Date.now() - 7*24*3600*1000).toISOString(),   // letzte 7 Tage
    timeMax: new Date(Date.now() + 14*24*3600*1000).toISOString(),  // nächste 14 Tage
    maxResults: 50,
  });

  return NextResponse.json({ events: data.items ?? [] });
}
