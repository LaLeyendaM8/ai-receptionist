// app/api/ai/appointment/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClients } from "@/lib/supabaseClients";
import { appointmentPrompt } from "@/ai/prompts/appointment";
import { getServiceByMessage } from "@/ai/logic/services";
import { getOAuth2ForUser } from "@/lib/googleServer";
import { google } from "googleapis";
import { SupabaseClient } from "@supabase/supabase-js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function isISODate(s?: string | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function isTimeHM(s?: string | null): s is string {
  return !!s && /^\d{2}:\d{2}$/.test(s);
}

// Overlap-Check inkl. optional staff_id
async function hasOverlap(
  supabase: any,
  clientId: string,
  startISO: string,
  endISO: string,
  staffId?: string
): Promise<boolean> {
  let query = supabase
    .from("appointments")
    .select("id")
    .eq("client_id", clientId)
    .neq("status", "cancelled")
    .lte("start_at", endISO)
    .gte("end_at", startISO);

  if (staffId) {
    query = query.eq("staff_id", staffId);
  }

  const { data } = await query;
  return Array.isArray(data) && data.length > 0;
}

// helper: prüft, ob Start/Ende innerhalb der Öffnungszeiten liegen


type HoursResult =
  | { ok: true }
  | { ok: false; reason: "no_hours" | "closed" | "outside" };

export async function isWithinBusinessHours(
  supabase: SupabaseClient,
  clientId: string,
  start: Date,
  end: Date
): Promise<HoursResult> {
  // 0 = Sonntag, 1 = Montag, ... 6 = Samstag
  const weekday = start.getDay();

  const { data: hours, error } = await supabase
    .from("business_hours")
    .select("weekday, open_min, close_min, is_closed")
    .eq("client_id", clientId)
    .eq("weekday", weekday)
    .maybeSingle();

  if (error) {
    console.error("HOURS query error", error);
    return {ok: false, reason: "no_hours"};
  }

  if (!hours) {
    console.log("HOURS no row", { clientId, weekday });
    return { ok: false, reason: "no_hours" };
  }

  if (hours.is_closed) {
    console.log("HOURS closed", { clientId, weekday });
    return { ok: false, reason: "closed" };
  }

  const minutesSinceMidnight = (d: Date) =>
    d.getHours() * 60 + d.getMinutes(); // **WICHTIG: NICHT getUTCHours**

  const sMin = minutesSinceMidnight(start);
  const eMin = minutesSinceMidnight(end);

  console.log("HOURS CHECK", {
    weekday,
    sMin,
    eMin,
    open_min: hours.open_min,
    close_min: hours.close_min,
  });

  if (sMin < hours.open_min || eMin > hours.close_min) {
    return { ok: false, reason: "outside" };
  }

  return { ok: true };
}


export async function POST(req: Request) {
  try {
    const supabase = createClients();

    // User ermitteln (DEV_USER_ID als Fallback)
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id ?? process.env.DEV_USER_ID!;
    if (!userId) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    // Request lesen
    const body = await req.json().catch(() => null);
    const message: string | undefined = body?.message;
    if (!message) return NextResponse.json({ error: "bad_json" }, { status: 400 });

    // 1) Intent/Parsing via LLM
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: appointmentPrompt },
        { role: "user", content: message },
      ],
    });

    let parsed: any = {};
    try {
      parsed = JSON.parse(completion.choices[0].message?.content || "{}");
    } catch {
      return NextResponse.json({ status: "none" });
    }

    const intent = parsed?.intent || "none";

    // Client des Users holen (Onboarding sorgt dafür)
    const { data: clientRow, error: clientErr } = await supabase
      .from("clients")
      .select("id")
      .eq("owner_user", userId)
      .single();

    if (clientErr || !clientRow?.id) {
      return NextResponse.json(
        {
          status: "need_client",
          message: "Bitte Onboarding abschließen (Firmendaten/Öffnungszeiten/Services).",
        },
        { status: 200 }
      );
    }

    const clientId = clientRow.id as string;

    // ------------------------------------------------------------------
    // CASE 1: INFO – "Wann ist mein Termin?"
    // ------------------------------------------------------------------
    if (intent === "appointment_info") {
      const nowISO = new Date().toISOString();
const customerName: string | null = parsed.customer_name ?? null;

let query = supabase
  .from("appointments")
  .select("*")
  .eq("client_id", clientId)
  .neq("status", "cancelled")
  .gte("start_at", nowISO);

if (customerName) {
  query = query.eq("customer_name", customerName);
}

const { data: nextAppt } = await query
  .order("start_at", { ascending: true })
  .limit(1)
  .maybeSingle();

      const start = new Date(nextAppt.start_at);
      const dateStr = start.toLocaleDateString("de-DE", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "Europe/Berlin",
      });
      const timeStr = start.toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Berlin",
      });

      return NextResponse.json(
        {
          status: "info",
          message: `Du hast einen Termin am ${dateStr} um ${timeStr} für "${nextAppt.title}".`,
          appointmentId: nextAppt.id,
        },
        { status: 200 }
      );
    }

    // ------------------------------------------------------------------
    // CASE 2: CANCEL – bestehenden Termin stornieren
    // ------------------------------------------------------------------
    if (intent === "cancel_appointment") {
      const date: string | null = parsed.date;
      const time: string | null = parsed.time;
      const customerName: string | null = parsed.customer_name ?? null;

      if (!isISODate(date)) {
        return NextResponse.json(
          {
            status: "need_info",
            missing: "date",
            question: "Für welches Datum soll ich den Termin stornieren? (YYYY-MM-DD)",
          },
          { status: 200 }
        );
      }
      if (!isTimeHM(time)) {
        return NextResponse.json(
          {
            status: "need_info",
            missing: "time",
            question: "Um wie viel Uhr war der Termin, den du stornieren möchtest? (HH:MM)",
          },
          { status: 200 }
        );
      }
if (!customerName) {
  return NextResponse.json(
    {
      status: "need_info",
      missing: "customer_name",
      question: "Auf welchen Namen ist der Termin eingetragen?",
    },
    { status: 200 }
  );
}
      const startLocal = `${date}T${time}:00`;
      const targetStart = new Date(startLocal);
      const targetISO = targetStart.toISOString();

      let q = supabase
        .from("appointments")
        .select("*")
        .eq("client_id", clientId)
        .neq("status", "cancelled")
        .eq("start_at", targetISO)
        .eq("customer_name", customerName);
      
        const {data: appt, error: apptErr} = await q.maybeSingle();

      if (apptErr || !appt) {
        return NextResponse.json(
          {
            status: "cancel_not_found",
            message: "Ich konnte zu diesem Zeitpunkt keinen passenden Termin finden.",
          },
          { status: 200 }
        );
      }

      // Google-Kalender-Event ggf. löschen
      if (appt.google_event_id) {
        try {
          const { oauth2 } = await getOAuth2ForUser(userId);
          const calendar = google.calendar({ version: "v3", auth: oauth2 });
          await calendar.events.delete({
            calendarId: "primary",
            eventId: appt.google_event_id,
          });
        } catch (e) {
          console.error("google cancel failed:", e);
        }
      }

      await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", appt.id);

      return NextResponse.json(
        {
          status: "cancelled",
          message: `Alles klar – ich habe den Termin am ${date} um ${time} storniert.`,
          appointmentId: appt.id,
        },
        { status: 200 }
      );
    }

    // ------------------------------------------------------------------
    // CASE 3: RESCHEDULE – nächsten Termin verschieben
    // (einfaches Modell: wir nehmen den nächsten zukünftigen Termin des Kunden)
    // ------------------------------------------------------------------
    if (intent === "reschedule_appointment") {
      const newDate: string | null = parsed.new_date;
      const newTime: string | null = parsed.new_time;
      const customerName: string | null = parsed.customer_name ?? null;

      if (!isISODate(newDate)) {
        return NextResponse.json(
          {
            status: "need_info",
            missing: "new_date",
            question: "Auf welches Datum möchtest du den Termin verschieben? (YYYY-MM-DD)",
          },
          { status: 200 }
        );
      }
      if (!isTimeHM(newTime)) {
        return NextResponse.json(
          {
            status: "need_info",
            missing: "new_time",
            question: "Auf welche Uhrzeit möchtest du den Termin verschieben? (HH:MM)",
          },
          { status: 200 }
        );
      }
      if (!customerName) {
  return NextResponse.json(
    {
      status: "need_info",
      missing: "customer_name",
      question: "Auf welchen Namen ist der aktuelle Termin eingetragen?",
    },
    { status: 200 }
  );
}

      const nowISO = new Date().toISOString();
      const { data: oldAppt } = await supabase
        .from("appointments")
        .select("*")
        .eq("client_id", clientId)
        .eq("customer_name", customerName)
        .neq("status", "cancelled")
        .gte("start_at", nowISO)
        .order("start_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!oldAppt) {
        return NextResponse.json(
          {
            status: "reschedule_none",
            message: "Es ist kein zukünftiger Termin eingetragen, den ich verschieben könnte.",
          },
          { status: 200 }
        );
      }

      const oldStart = new Date(oldAppt.start_at);
      const oldEnd = new Date(oldAppt.end_at);
      const durationMs = oldEnd.getTime() - oldStart.getTime();

      const newStartLocal = `${newDate}T${newTime}:00`;
      const newStart = new Date(newStartLocal);
      const now = new Date();
if (newStart.getTime() <= now.getTime()) {
  return NextResponse.json(
    {
      status: "need_info",
      missing: "new_date",
      question:
        "Das neue Datum liegt in der Vergangenheit. Auf welches zukünftige Datum möchtest du verschieben? (YYYY-MM-DD)",
    },
    { status: 200 }
  );
}
      const newEnd = new Date(newStart.getTime() + durationMs);

      const newStartISO = newStart.toISOString();
      const newEndISO = newEnd.toISOString();

      // Öffnungszeiten-Check
      // nachdem du newStart und newEnd (Date-Objekte) gebaut hast:
const hoursResult = await isWithinBusinessHours(
  supabase,
  clientId,
  newStart,
  newEnd
);

if (!hoursResult.ok) {
  const msg =
    hoursResult.reason === "closed"
      ? "An dem Tag ist geschlossen. Hast du einen anderen Tag im Kopf?"
      : "Die Uhrzeit liegt außerhalb der Öffnungszeiten. Welche Zeit innerhalb der Öffnungszeiten passt dir?";

  return NextResponse.json(
    {
      status: "need_info",
      missing: "time",
      question: msg,
    },
    { status: 200 }
  );
}
console.log("PASSED HOURS CHECK");

      // Overlap-Check (optional nach staff_id einschränken)
      const staffId = oldAppt.staff_id ?? undefined;
      if (await hasOverlap(supabase, clientId, newStartISO, newEndISO, staffId)) {
        return NextResponse.json(
          {
            status: "need_info",
            missing: "new_time",
            question: "Dieser Slot ist belegt. Eine andere Uhrzeit (z. B. 30 Min früher oder später)?",
          },
          { status: 200 }
        );
      }

      // DB-Termin updaten
      const { data: updated, error: updErr } = await supabase
        .from("appointments")
        .update({
          start_at: newStartISO,
          end_at: newEndISO,
        })
        .eq("id", oldAppt.id)
        .select()
        .maybeSingle();

      if (updErr || !updated) {
        return NextResponse.json(
          { error: "reschedule_failed", details: updErr?.message },
          { status: 500 }
        );
      }

      // Google-Event updaten
      if (updated.google_event_id) {
        try {
          const { oauth2 } = await getOAuth2ForUser(userId);
          const calendar = google.calendar({ version: "v3", auth: oauth2 });
          await calendar.events.patch({
            calendarId: "primary",
            eventId: updated.google_event_id,
            requestBody: {
              start: { dateTime: newStartISO, timeZone: "Europe/Berlin" },
              end: { dateTime: newEndISO, timeZone: "Europe/Berlin" },
            },
          });
        } catch (e) {
          console.error("google reschedule failed:", e);
        }
      }

      const oldDateStr = oldStart.toLocaleDateString("de-DE", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        timeZone: "Europe/Berlin",
      });
      const oldTimeStr = oldStart.toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Berlin",
      });

      const newDateStr = newStart.toLocaleDateString("de-DE", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        timeZone: "Europe/Berlin",
      });
      const newTimeStr = newStart.toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Berlin",
      });

      return NextResponse.json(
        {
          status: "rescheduled",
          message: `Ich habe deinen Termin von ${oldDateStr} ${oldTimeStr} auf ${newDateStr} ${newTimeStr} verschoben.`,
          appointmentId: updated.id,
        },
        { status: 200 }
      );
    }

    // ------------------------------------------------------------------
    // CASE 4: CREATE – neuer Termin (bestehende Logik)
    // ------------------------------------------------------------------
    if (intent !== "create_appointment") {
      // keine Termin-Intention
      return NextResponse.json({ status: "none" }, { status: 200 });
    }

    // 2) Fehlende Infos abfragen (wie bisher)
    if (parsed.missing) {
      const q =
        parsed.missing === "date"
          ? "An welchem Tag möchtest du den Termin? (YYYY-MM-DD)"
          : parsed.missing === "time"
          ? "Welche Uhrzeit passt dir? (HH:MM, 24h)"
          : "Welche Leistung möchtest du genau? (z. B. Haarschnitt)?";

      return NextResponse.json(
        {
          status: "need_info",
          missing: parsed.missing,
          question: q,
          draft: parsed,
        },
        { status: 200 }
      );
    }

    // 3) Format-Check
    if (!isISODate(parsed.date)) {
      return NextResponse.json(
        {
          status: "need_info",
          missing: "date",
          question: "Welches Datum genau? Bitte im Format YYYY-MM-DD.",
        },
        { status: 200 }
      );
    }
    if (!isTimeHM(parsed.time)) {
      return NextResponse.json(
        {
          status: "need_info",
          missing: "time",
          question: "Welche Uhrzeit genau? Bitte im Format HH:MM (24h).",
        },
        { status: 200 }
      );
    }

    // 4) Service mappen
    const serviceText: string | null = parsed.service;
    const svc = await getServiceByMessage(supabase, clientId, serviceText || "");
    if (!svc) {
      return NextResponse.json(
        {
          status: "need_info",
          missing: "service",
          question:
            "Für welche Leistung möchtest du buchen? (z. B. Haarschnitt, Färben, Maniküre)",
        },
        { status: 200 }
      );
    }

    const durationMin = svc.durationMin ?? 30;
    const staffId: string | null = svc.defaultStaffId ?? null;

    // 4b) Kundendaten prüfen
const customerName: string | null = parsed.customer_name ?? null;
const customerPhone: string | null = parsed.customer_phone ?? null;

if (!customerName) {
  return NextResponse.json(
    {
      status: "need_info",
      missing: "customer_name",
      question: "Auf welchen Namen darf ich den Termin eintragen?",
      draft: parsed, // optional: damit Frontend/Call-Flow Kontext hat
    },
    { status: 200 }
  );
}

    // 5) Start/Ende bestimmen
    const startLocal = `${parsed.date}T${parsed.time}:00`;
    const startAt = new Date(startLocal);
    const now = new Date();
if (startAt.getTime() <= now.getTime()) {
  return NextResponse.json(
    {
      status: "need_info",
      missing: "date",
      question:
        "Das Datum liegt in der Vergangenheit. Welches zukünftige Datum passt dir? (Bitte YYYY-MM-DD)",
    },
    { status: 200 }
  );
}
    const endAt = new Date(startAt.getTime() + durationMin * 60 * 1000);
    const startISO = startAt.toISOString();
    const endISO = endAt.toISOString();

    // 6) Öffnungszeiten-Check
   const hoursResult = await isWithinBusinessHours(
  supabase,
  clientId,
  startAt,
  endAt
);

if (!hoursResult.ok) {
  const msg =
    hoursResult.reason === "closed"
      ? "An dem Tag ist geschlossen. Hast du einen anderen Tag im Kopf?"
      : "Die Uhrzeit liegt außerhalb der Öffnungszeiten. Welche Zeit innerhalb der Öffnungszeiten passt dir?";

  return NextResponse.json(
    {
      status: "need_info",
      missing: "time",
      question: msg,
    },
    { status: 200 }
  );
}
// 7) Overlap-Check
console.log("[APPOINTMENT] BEFORE_OVERLAP", {
  startISO,
  endISO,
  staffId,
});

const hasOverlapResult = await hasOverlap(
  supabase,
  clientId,
  startISO,
  endISO,
  staffId || undefined
);

console.log("[APPOINTMENT] AFTER_OVERLAP", { hasOverlapResult });

if (hasOverlapResult) {
  return NextResponse.json(
    {
      status: "need_info",
      missing: "time",
      question: "Dieser Slot ist belegt. 30 Min früher oder später okay?",
    },
    { status: 200 }
  );
}

// 8) Draft speichern
console.log("[APPOINTMENT] BEFORE_DRAFT_INSERT", {
  userId,
  clientId,
  svc,
  startISO,
  endISO,
  staffId,
});

const { data: draft, error: dErr } = await supabase
  .from("appointment_drafts")
  .insert({
    user_id: userId,
    client_id: clientId,
    title: svc.title,
    start_at: startISO,
    end_at: endISO,
    service_id: svc.id,
    staff_id: staffId,
    source: "ai",
    customer_name: customerName,
    customer_phone: customerPhone,
  })
  .select()
  .single();

if (dErr) {
  console.error("[APPOINTMENT] DRAFT_INSERT_ERROR", dErr);
  return NextResponse.json(
    {
      status: "error",
      error: "draft_insert_failed",
      details: dErr,
    },
    { status: 500 }
  );
}

console.log("[APPOINTMENT] AFTER_DRAFT_INSERT", draft);


    // 9) Freundliche Bestätigungsfrage
    const preview = `${svc.title}; ${parsed.date} ${parsed.time}`;
    return NextResponse.json(
      {
        status: "confirm",
        draftId: draft.id,
        preview,
        phrase: `Ich habe „${svc.title}“ für ${parsed.date} um ${parsed.time} eingetragen. Soll ich den Termin fix eintragen?`,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    console.error("[/api/ai/appointment] ERROR", err);

    const message = 
       err instanceof Error ? err.message : JSON.stringify(err, null, 2);
    return NextResponse.json(
      { status: "error", error: "internal_error", details: message },
      { status: 500 }
    );
  }
}
