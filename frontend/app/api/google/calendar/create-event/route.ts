import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClients } from "@/lib/supabaseClients";
import { getCurrentUserId } from "@/lib/authServer";

export async function POST(req: Request) {
  try {
    const supabase = createClients();

    const userId = await getCurrentUserId(supabase);
        if (!userId) {
          return NextResponse.json(
            { error: "unauthenticated" },
            { status: 401 }
          );
        }

    // Tokens laden
    const { data: tokens, error: tErr } = await supabase
      .from("google_tokens")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (tErr || !tokens) return NextResponse.json({ error: "no_tokens" }, { status: 400 });

    // OAuth2-Client
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!
      // redirectUri für Insert nicht nötig
    );
    oauth2.setCredentials({
      access_token: tokens.access_token ?? undefined,
      refresh_token: tokens.refresh_token ?? undefined,
      expiry_date: typeof tokens.expiry_date === "number" ? tokens.expiry_date : undefined,
      token_type: tokens.token_type ?? undefined,
      scope: tokens.scope ?? undefined,
    });

    const body = await req.json(); // { summary, description, startISO, endISO, timezone? }
    const calendar = google.calendar({ version: "v3", auth: oauth2 });

    const res = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: body.summary,
        description: body.description,
        start: { dateTime: body.startISO, timeZone: body.timezone || "Europe/Berlin" },
        end:   { dateTime: body.endISO,   timeZone: body.timezone || "Europe/Berlin" },
      },
    });

    // Nach dem Call aktualisierte Credentials persistieren (falls refreshed)
    const c = oauth2.credentials;
    await supabase
      .from("google_tokens")
      .update({
        access_token: c.access_token ?? tokens.access_token,
        expiry_date:  c.expiry_date  ?? tokens.expiry_date,
        scope:        c.scope        ?? tokens.scope,
        token_type:   c.token_type   ?? tokens.token_type,
        updated_at:   new Date().toISOString(),
      })
      .eq("user_id", userId);

    return NextResponse.json({ ok: true, eventId: res.data.id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "error" }, { status: 500 });
  }
}
