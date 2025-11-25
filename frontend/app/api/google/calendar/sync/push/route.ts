import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getOAuth2ForUser } from "@/lib/googleServer";
import { getCurrentUserId } from "@/lib/authServer";
import { createClients } from "@/lib/supabaseClients";

export async function POST() {
  const supabase = await createClients();
      const userId = await getCurrentUserId(supabase);
          if (!userId) {
            return NextResponse.json(
              { error: "unauthenticated" },
              { status: 401 }
            );
          }
  const { oauth2 } = await getOAuth2ForUser(userId);
  const calendar = google.calendar({ version: "v3", auth: oauth2 });

  // Hole alle Termine der Zukunft (AI-Quelle), inkl. evtl. 'canceled'
  const { data: appts, error } = await supabase
    .from("appointments")
    .select("id,title,notes,start_at,end_at,status,google_event_id,source")
    .gte("start_at", new Date().toISOString());
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const results: any[] = [];

  for (const a of (appts ?? [])) {
    try {
      // cancel -> Google löschen, ID in DB leeren
      if (a.status === "canceled" && a.google_event_id) {
        await calendar.events.delete({ calendarId: "primary", eventId: a.google_event_id });
        await supabase.from("appointments").update({ google_event_id: null }).eq("id", a.id);
        results.push({ id: a.id, action: "deleted" });
        continue;
      }

      // create
      if (!a.google_event_id && a.status !== "canceled") {
        const ins = await calendar.events.insert({
          calendarId: "primary",
          requestBody: {
            summary: a.title ?? "Termin",
            description: a.notes ?? undefined,
            start: { dateTime: new Date(a.start_at).toISOString(), timeZone: "Europe/Berlin" },
            end:   { dateTime: new Date(a.end_at).toISOString(),   timeZone: "Europe/Berlin" },
          },
        });
        await supabase.from("appointments")
          .update({ google_event_id: ins.data.id, source: a.source ?? "ai" })
          .eq("id", a.id);
        results.push({ id: a.id, action: "created", eventId: ins.data.id });
        continue;
      }

      // update
      if (a.google_event_id && a.status !== "canceled") {
        await calendar.events.patch({
          calendarId: "primary",
          eventId: a.google_event_id,
          requestBody: {
            summary: a.title ?? "Termin",
            description: a.notes ?? undefined,
            start: { dateTime: new Date(a.start_at).toISOString(), timeZone: "Europe/Berlin" },
            end:   { dateTime: new Date(a.end_at).toISOString(),   timeZone: "Europe/Berlin" },
          },
        });
        results.push({ id: a.id, action: "updated", eventId: a.google_event_id });
      }
    } catch (e:any) {
      results.push({ id: a.id, action: "error", message: e?.message });
    }
  }

  // neue Credentials (Refresh) optional speichern
  const c = (oauth2 as any).credentials;
  await supabase.from("google_tokens").update({
    access_token: c.access_token ?? undefined,
    expiry_date:  c.expiry_date ?? undefined,
    scope:        c.scope ?? undefined,
    token_type:   c.token_type ?? undefined,
    updated_at:   new Date().toISOString(),
  }).eq("user_id", userId);

  return NextResponse.json({ ok: true, results });
}
