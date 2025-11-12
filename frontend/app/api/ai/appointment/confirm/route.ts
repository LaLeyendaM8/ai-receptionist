// app/api/ai/appointment/confirm/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClients } from "@/lib/supabaseClients";
import { getOAuth2ForUser } from "@/lib/googleServer";
import { google } from "googleapis";

async function ensureClientForUser(supabase: any, userId: string): Promise<string> {
  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .eq("owner_user", userId)
    .single();
  if (existing?.id) return existing.id as string;

  const { data: created, error: cErr } = await supabase
    .from("clients")
    .insert({
      name: "Testkunde",
      phone: "",
      email: "",
      address: {},
      timezone: "Europe/Berlin",
      active: true,
      owner_user: userId,
    })
    .select("id")
    .single();
  if (cErr) throw cErr;
  return created!.id as string;
}

function minutes(d: Date) { return d.getUTCHours() * 60 + d.getUTCMinutes(); }

async function isWithinHours(supabase: any, clientId: string, start: Date, end: Date) {
  const { data: hours } = await supabase
    .from("business_hours")
    .select("weekday, open_min, close_min, is_closed")
    .eq("client_id", clientId)
    .eq("weekday", start.getUTCDay())
    .maybeSingle();

  if (!hours || hours.is_closed) return false;
  const sMin = minutes(start);
  const eMin = minutes(end);
  return sMin >= hours.open_min && eMin <= hours.close_min;
}

async function hasOverlap(supabase: any, clientId: string, startISO: string, endISO: string) {
  const { data } = await supabase
    .from("appointments")
    .select("id")
    .eq("client_id", clientId)
    .neq("status", "cancelled")
    .lte("start_at", endISO)
    .gte("end_at", startISO);
  return Array.isArray(data) && data.length > 0;
}

export async function POST(req: Request) {
  try {
    const supabase = createClients();
    const body = await req.json().catch(() => null);
    const draftId: string | undefined = body?.draftId;
    const userIdFromBody: string | undefined = body?.userId;

    const { data: auth } = await supabase.auth.getUser();
    const userId = userIdFromBody ?? auth?.user?.id ?? process.env.DEV_USER_ID!;
    if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    if (!draftId) return NextResponse.json({ error: "missing_draftId" }, { status: 400 });

    // Draft holen
    const { data: draft, error: dErr } = await supabase
      .from("appointment_drafts")
      .select("*")
      .eq("id", draftId)
      .single();
    if (dErr || !draft) return NextResponse.json({ error: "draft_not_found" }, { status: 404 });

    const clientId = draft.client_id ?? (await ensureClientForUser(supabase, userId));
    const startAt = new Date(draft.start_at);
    const endAt = new Date(draft.end_at);

    // Safety-Checks
    if (!(await isWithinHours(supabase, clientId, startAt, endAt))) {
      return NextResponse.json({ error: "outside_business_hours" }, { status: 409 });
    }
    if (await hasOverlap(supabase, clientId, draft.start_at, draft.end_at)) {
      return NextResponse.json({ error: "slot_taken" }, { status: 409 });
    }

    // Termin in DB
    const { data: appts, error: aErr } = await supabase
      .from("appointments")
      .insert({
        client_id: clientId,
        title: draft.title ?? "Termin",
        start_at: draft.start_at,
        end_at: draft.end_at,
        status: "booked",
        source: "ai",
        notes: draft.notes ?? "",
      })
      .select()
      .limit(1);

    if (aErr) return NextResponse.json({ error: "db_insert_failed", details: aErr.message }, { status: 500 });
    const appointment = appts![0];

    // Google Event
    const { oauth2 } = await getOAuth2ForUser(userId);
    const calendar = google.calendar({ version: "v3", auth: oauth2 });
    const ins = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: appointment.title,
        description: "Erstellt durch AI-Rezeptionist",
        start: { dateTime: appointment.start_at, timeZone: "Europe/Berlin" },
        end: { dateTime: appointment.end_at, timeZone: "Europe/Berlin" },
      },
    });

    if (ins.data.id) {
      await supabase
        .from("appointments")
        .update({ google_event_id: ins.data.id })
        .eq("id", appointment.id);
    }

    // Draft weg
    await supabase.from("appointment_drafts").delete().eq("id", draftId);

    return NextResponse.json({
      status: "created",
      appointment,
      googleEventId: ins.data.id ?? undefined,
      say: `Alles klar – ich habe den Termin eingetragen und dir im Kalender hinterlegt.`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: "confirm_failed", details: e?.message }, { status: 500 });
  }
}
