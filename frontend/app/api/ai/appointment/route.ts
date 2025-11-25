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
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUserId } from "@/lib/authServer";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function isISODate(s?: string | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function isTimeHM(s?: string | null): s is string {
  return !!s && /^\d{2}:\d{2}$/.test(s);
}

/**
 * Business-Hours eines bestimmten Tages holen.
 * (0 = Sonntag, 1 = Montag, ... 6 = Samstag)
 */
async function getBusinessHoursForDay(
  supabase: SupabaseClient,
  clientId: string,
  day: Date
) {
  const weekday = day.getDay();

  const { data, error } = await supabase
    .from("business_hours")
    .select("open_min, close_min, is_closed")
    .eq("client_id", clientId)
    .eq("weekday", weekday)
    .maybeSingle();

  if (error) {
    console.error("getBusinessHoursForDay error", { clientId, weekday, error });
    return null;
  }

  return data as
    | { open_min: number; close_min: number; is_closed: boolean }
    | null;
}

/**
 * Freie Slots für einen Tag finden (minutengenau, z.B. in 15-Min-Schritten).
 * Gibt eine Liste von Uhrzeiten als String ("HH:MM") in Europe/Berlin zurück.
 */
// HH:MM → Minuten seit Mitternacht
function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Freie Slots für einen Tag (minutengenau, z. B. in 15-Minuten-Schritten).
 * Gibt eine Liste von Uhrzeiten als String ("HH:MM") in Europe/Berlin zurück.
 */
async function findNextFreeSlots(
  supabase: SupabaseClient,
  clientId: string,
  staffId: string | null,
  day: Date,
  durationMin: number,
  maxSuggestions = 3,
  windowStartMin?: number, // z. B. 14:00 → 840
  windowEndMin?: number    // z. B. 18:00 → 1080
) {
  const suggestions: string[] = [];

  // Tag auf Mitternacht setzen
  const dayMidnight = new Date(day);
  dayMidnight.setHours(0, 0, 0, 0);

  // 1) Öffnungszeiten holen
  const hours = await getBusinessHoursForDay(supabase, clientId, dayMidnight);
  if (!hours || hours.is_closed) return suggestions;

  let startMinute = hours.open_min;   // z. B. 540 (09:00)
  let endMinute = hours.close_min;    // z. B. 1080 (18:00)

  // 2) Zeitfenster des Users berücksichtigen
  if (typeof windowStartMin === "number" && windowStartMin > startMinute) {
    startMinute = windowStartMin;
  }
  if (typeof windowEndMin === "number" && windowEndMin < endMinute) {
    endMinute = windowEndMin;
  }

  console.log("[AVAIL] window", {
    open_min: hours.open_min,
    close_min: hours.close_min,
    startMinute,
    endMinute,
    windowStartMin,
    windowEndMin,
  });

  // 3) Minuten über den Tag iterieren (z. B. 15-Minuten-Schritte)
  for (
    let m = startMinute;
    m + durationMin <= endMinute && suggestions.length < maxSuggestions;
    m += 15
  ) {
    const candidateStart = new Date(dayMidnight);
    const h = Math.floor(m / 60);
    const min = m % 60;
    candidateStart.setHours(h, min, 0, 0);

    const candidateEnd = new Date(
      candidateStart.getTime() + durationMin * 60 * 1000
    );

    const startISO = candidateStart.toISOString();
    const endISO = candidateEnd.toISOString();

    const overlap = await hasOverlap(
      supabase,
      clientId,
      startISO,
      endISO,
      staffId || undefined
    );

    if (!overlap) {
      suggestions.push(
        candidateStart.toLocaleTimeString("de-DE", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Berlin",
        })
      );
    }
  }

  return suggestions;
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
    return { ok: false, reason: "no_hours" };
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
    const supabase = await createClients();

    // User ermitteln (DEV_USER_ID als Fallback)
    const userId = await getCurrentUserId(supabase);
    if (!userId) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    // Request lesen
    const body = await req.json().catch(() => null);
    const message: string | undefined = body?.message;
    if (!message)
      return NextResponse.json({ error: "bad_json" }, { status: 400 });

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
      console.error("[APPOINTMENT] client not configured", { userId, clientErr });

      return NextResponse.json(
        {
          status: "error",
          error: "client_not_configured",
          message:
            "Aktuell kann ich leider keine Termine anlegen. Bitte versuchen Sie es später erneut.",
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
      const customerName: string | null = (parsed.customer_name && String(parsed.customer_name).trim()) || null;
      const customerPhone: string | null = (parsed.customer_phone && String(parsed.customer_phone).trim()) || null;

      if (!customerName && !customerPhone){
        return NextResponse.json({
          status: "need_info",
          missing: "customer_name",
          question: "Auf welchen Namen ist der Termin eingetragen?",
        },
        {status: 200}
      );
      }

      let query = supabase
        .from("appointments")
        .select("*")
        .eq("client_id", clientId)
        .neq("status", "cancelled")
        .gte("start_at", nowISO);

      if (customerName) {
        query = query.eq("customer_name", customerName);
      }

       if (customerPhone) {
        query = query.eq("customer_phone", customerPhone);
      }

      const { data: nextAppt } = await query
        .order("start_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!nextAppt) {
        return NextResponse.json(
          {
            status: "info_none",
            message: "Ich finde keinen zukünftigen Termin für Sie.",
          },
          { status: 200 }
        );
      }

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
          message: `Sie haben einen Termin am ${dateStr} um ${timeStr} für "${nextAppt.title}".`,
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
            question:
              "Für welches Datum soll ich den Termin stornieren? (YYYY-MM-DD)",
          },
          { status: 200 }
        );
      }
      if (!isTimeHM(time)) {
        return NextResponse.json(
          {
            status: "need_info",
            missing: "time",
            question:
              "Um wie viel Uhr war der Termin, den sie stornieren möchten? (HH:MM)",
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

      const { data: appt, error: apptErr } = await supabase
        .from("appointments")
        .select("*")
        .eq("client_id", clientId)
        .neq("status", "cancelled")
        .eq("start_at", targetISO)
        .eq("customer_name", customerName)
        .maybeSingle();

     if (apptErr){
      console.error("[CANCEL] query error", apptErr);
     } 
     if (apptErr || !appt) {
        return NextResponse.json(
          {
            status: "cancel_not_found",
            message:
              "Ich konnte zu diesem Zeitpunkt keinen passenden Termin finden.",
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

     const {data: updated, error: updErr } = await supabase
      .from("appointments")
      .update({ status: "cancelled"})
      .eq("id", appt.id)
      .select()
      .maybeSingle();

    if (updErr) {
      console.error("[CANCEL] update error", updErr);
      return NextResponse.json(
        {
          status: "error",
          error: "cancel_update_failed",
          details: updErr.message,
        },
        { status: 500 }
      );
    }
    if (!updated) {
      console.error("[CANCEL] update returned no row for id", appt.id);
      return NextResponse.json(
        {
          status: "error",
          error: "cancel_not_found_after_update",
        },
        { status: 500 }
      );
    }
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
            question:
              "Auf welches Datum möchten sie den Termin verschieben? (YYYY-MM-DD)",
          },
          { status: 200 }
        );
      }
      if (!isTimeHM(newTime)) {
        return NextResponse.json(
          {
            status: "need_info",
            missing: "new_time",
            question:
              "Auf welche Uhrzeit möchten sie den Termin verschieben? (HH:MM)",
          },
          { status: 200 }
        );
      }
      if (!customerName) {
        return NextResponse.json(
          {
            status: "need_info",
            missing: "customer_name",
            question:
              "Auf welchen Namen ist der aktuelle Termin eingetragen?",
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
            message:
              "Es ist kein zukünftiger Termin eingetragen, den ich verschieben könnte.",
          },
          { status: 200 }
        );
      }

      const oldStart = new Date(oldAppt.start_at);
      const oldEnd = new Date(oldAppt.end_at);
      const durationMs = oldEnd.getTime() - oldStart.getTime();
      const durationMin = Math.round(durationMs / (60 * 1000));

      const newStartLocal = `${newDate}T${newTime}:00`;
      const newStart = new Date(newStartLocal);
      const now = new Date();
      if (newStart.getTime() <= now.getTime()) {
        return NextResponse.json(
          {
            status: "need_info",
            missing: "new_date",
            question:
              "Das neue Datum liegt in der Vergangenheit. Auf welches zukünftige Datum möchten sie verschieben? (YYYY-MM-DD)",
          },
          { status: 200 }
        );
      }
      const newEnd = new Date(newStart.getTime() + durationMs);

      const newStartISO = newStart.toISOString();
      const newEndISO = newEnd.toISOString();

      // Öffnungszeiten-Check
      const hoursResultReschedule = await isWithinBusinessHours(
        supabase,
        clientId,
        newStart,
        newEnd
      );

      if (!hoursResultReschedule.ok) {
        const msg =
          hoursResultReschedule.reason === "closed"
            ? "An dem Tag ist geschlossen. Haben sie einen anderen Tag im Kopf?"
            : "Die Uhrzeit liegt außerhalb der Öffnungszeiten. Welche Zeit innerhalb der Öffnungszeiten passt Ihnen?";

        return NextResponse.json(
          {
            status: "need_info",
            missing: "new_time",
            question: msg,
          },
          { status: 200 }
        );
      }
      console.log("PASSED HOURS CHECK (RESCHEDULE)");

      // Overlap-Check (optional nach staff_id einschränken)
      const staffIdReschedule = oldAppt.staff_id ?? null;
      const hasOverlapReschedule = await hasOverlap(
        supabase,
        clientId,
        newStartISO,
        newEndISO,
        staffIdReschedule || undefined
      );

      if (hasOverlapReschedule) {
        // Vorschlagslogik bei Overlap
        const day = new Date(newStart);
        day.setHours(0, 0, 0, 0);

        const suggestions = await findNextFreeSlots(
          supabase,
          clientId,
          staffIdReschedule,
          day,
          durationMin,
          5
        );

        const baseQuestion =
          "Dieser Slot ist belegt. Eine andere Uhrzeit (z. B. 30 Min früher oder später)?";

        const question =
          suggestions.length > 0
            ? `${baseQuestion} Zum Beispiel: ${suggestions.join(
                ", "
              )}. Welche Uhrzeit passt Ihnen?`
            : baseQuestion;

        return NextResponse.json(
          {
            status: "need_info",
            missing: "new_time",
            question,
            suggestions,
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
          message: `Ich habe Ihren Termin von ${oldDateStr} ${oldTimeStr} auf ${newDateStr} ${newTimeStr} verschoben.`,
          appointmentId: updated.id,
        },
        { status: 200 }
      );
    }

    // ------------------------------------------------------------------
    // CASE 4: AVAILABILITY – freie Zeiten abfragen
    // ------------------------------------------------------------------
    if (intent === "availability" || intent === "staff_availability") {
      const date: string | null = parsed.date ?? null;
      const durationMin: number = parsed.duration_min ?? 30;
      const requestedStaffName: string | null = parsed.preferred_staff ??parsed.staff ?? null;

      if (!isISODate(date)) {
        return NextResponse.json(
          {
            status: "need_info",
            missing: "date",
            question:
              "Für welchen Tag möchten Sie die freien Zeiten wissen? (YYYY-MM-DD)",
          },
          { status: 200 }
        );
      }

      let staffId: string | null = null;
      let staffName: string | null = null;

      if (intent === "staff_availability") {
        if (!requestedStaffName) {
          return NextResponse.json(
            {
              status: "need_info",
              missing: "staff",
              question:
                "Für welchen Mitarbeiter oder welche Mitarbeiterin möchten Sie die freien Zeiten wissen?",
            },
            { status: 200 }
          );
        }

        const { data: staffRow } = await supabase
          .from("staff")
          .select("id, name")
          .eq("client_id", clientId)
          .ilike("name", requestedStaffName)
          .maybeSingle();

        if (!staffRow) {
          return NextResponse.json(
            {
              status: "need_info",
              missing: "staff",
              question:
                "Ich habe diesen Namen nicht gefunden. Für welchen Mitarbeiter oder welche Mitarbeiterin soll ich schauen?",
            },
            { status: 200 }
          );
        }

        staffId = staffRow.id;
        staffName = staffRow.name;
      }

      const windowStart: string | null =  parsed.window_start ?? null;
      const windowEnd: string | null =  parsed.window_end ?? null;
      const windowStartMin = windowStart && isTimeHM(windowStart) ? hmToMinutes(windowStart) : null;
      const windowEndMin = windowEnd && isTimeHM(windowEnd) ? hmToMinutes(windowEnd) : null;
      const day = new Date(`${date}T12:00:00`);
      const suggestions = await findNextFreeSlots(
        supabase,
        clientId,
        staffId,
        day,
        durationMin,
        3,
        windowStartMin ?? undefined,
        windowEndMin ?? undefined
      );

      if (!suggestions.length) {
        const msg = staffName
          ? `Am ${date} habe ich für ${staffName} leider keine freien Slots gefunden.`
          : `Am ${date} habe ich leider keine freien Slots gefunden.`;

        return NextResponse.json(
          {
            status: "availability_none",
            message: msg,
            suggestions: [],
          },
          { status: 200 }
        );
      }

      const msg = staffName
        ? `Am ${date} hätte ${staffName} z. B. folgende freie Zeiten: ${suggestions.join(
            ", "
          )}.`
        : `Am ${date} hätte ich z. B. folgende freie Zeiten: ${suggestions.join(
            ", "
          )}.`;

      return NextResponse.json(
        {
          status: "availability",
          message: msg,
          suggestions,
          staff: staffName,
          date,
        },
        { status: 200 }
      );
    }

    // ------------------------------------------------------------------
    // CASE 5: CREATE – neuer Termin
    // ------------------------------------------------------------------
    if (intent !== "create_appointment") {
      // keine Termin-Intention
      return NextResponse.json({ status: "none" }, { status: 200 });
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

    // Schnell-Check, ist an dem Tag überhaupt offen?
    const testDate = new Date(`${parsed.date}T12:00:00`);
    const weekday = testDate.getDay();

    const { data: dayHours, error: dayErr } = await supabase
      .from("business_hours")
      .select("is_closed")
      .eq("client_id", clientId)
      .eq("weekday", weekday)
      .maybeSingle();

    if (!dayErr && dayHours?.is_closed) {
      return NextResponse.json(
        {
          status: "need_info",
          missing: "date",
          question:
            "An dem Tag ist geschlossen. Haben sie einen anderen Tag im Kopf?",
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

    // 2) Fehlende Infos abfragen (LLM-Flag)
    if (parsed.missing) {
      const q =
        parsed.missing === "date"
          ? "An welchem Tag möchten Sie den Termin? (YYYY-MM-DD)"
          : parsed.missing === "time"
          ? "Welche Uhrzeit passt Ihnen? (HH:MM, 24h)"
          : "Welche Leistung möchten sie genau? (z. B. Haarschnitt)?";

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

    // 4) Service mappen
    const serviceText: string | null = parsed.service;
    const svc = await getServiceByMessage(
      supabase,
      clientId,
      serviceText || ""
    );
    if (!svc) {
      return NextResponse.json(
        {
          status: "need_info",
          missing: "service",
          question:
            "Für welche Leistung möchten sie buchen? (z. B. Haarschnitt, Färben, Maniküre)",
        },
        { status: 200 }
      );
    }

    const durationMin = svc.durationMin ?? 30;

    // 4b) Kundendaten prüfen
    const customerName: string | null = parsed.customer_name ?? null;
    const customerPhone: string | null = parsed.customer_phone ?? null;
    const needsCustomerName = !customerName;

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
            "Das Datum liegt in der Vergangenheit. Welches zukünftige Datum passt Ihnen? (Bitte YYYY-MM-DD)",
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
      if (hoursResult.reason === "closed") {
        return NextResponse.json(
          {
            status: "need_info",
            missing: "date",
            question:
              "An dem Tag ist geschlossen. Haben sie einen anderen Tag im Kopf?",
          },
          { status: 200 }
        );
      }
      return NextResponse.json(
        {
          status: "need_info",
          missing: "time",
          question:
            "Die Uhrzeit liegt außerhalb der Öffnungszeiten. Welche Zeit innerhalb der Öffnungszeiten passt Ihnen?",
        },
        { status: 200 }
      );
    }

    // 7) STAFF-LOGIK (NEU)
    const requestedStaffName: string | null = parsed.preferred_staff ?? parsed.staff ?? null;
    let staffId: string | null = null;
    let staffName: string | null = null;

    // 7a) Wenn Kunde explizit Mitarbeiter genannt hat → diesen suchen
    if (requestedStaffName) {
      const { data: staffRow } = await supabase
        .from("staff")
        .select("id, name")
        .eq("client_id", clientId)
        .ilike("name", requestedStaffName)
        .maybeSingle();

      if (!staffRow) {
        return NextResponse.json(
          {
            status: "need_info",
            missing: "staff",
            question:
              "Welcher Mitarbeiter oder welche Mitarbeiterin soll es sein?",
          },
          { status: 200 }
        );
      }

      staffId = staffRow.id;
      staffName = staffRow.name;

      const overlapRequested = await hasOverlap(
        supabase,
        clientId,
        startISO,
        endISO,
        staffId || undefined
      );

      if (overlapRequested) {
        // Vorschläge NUR für diesen Staff
        const day = new Date(startAt);
        day.setHours(0, 0, 0, 0);

        const suggestions = await findNextFreeSlots(
          supabase,
          clientId,
          staffId,
          day,
          durationMin,
          5
        );

        const baseQuestion = `Zu dieser Zeit ist ${staffName} bereits ausgebucht.`;
        const question =
          suggestions.length > 0
            ? `${baseQuestion} Ich könnte Ihnen zum Beispiel ${suggestions.join(
                ", "
              )} anbieten. Welche Uhrzeit passt Ihnen?`
            : `${baseQuestion} Haben Sie eine andere Uhrzeit im Kopf?`;

        return NextResponse.json(
          {
            status: "need_info",
            missing: "time",
            question,
            suggestions,
          },
          { status: 200 }
        );
      }
    } else {
      // 7b) Kein Wunsch geäußert → Default Staff versuchen
      if (svc.defaultStaffId) {
        const overlapDefault = await hasOverlap(
          supabase,
          clientId,
          startISO,
          endISO,
          svc.defaultStaffId
        );

        if (!overlapDefault) {
          staffId = svc.defaultStaffId;
          const { data: defaultStaffRow } = await supabase
            .from("staff")
            .select("name")
            .eq("id", svc.defaultStaffId)
            .maybeSingle();
          staffName = defaultStaffRow?.name ?? null;
        }
      }

      // 7c) Wenn kein Default oder Default voll → freien Staff suchen
      if (!staffId) {
        const { data: staffList } = await supabase
          .from("staff")
          .select("id, name")
          .eq("client_id", clientId);

        if (Array.isArray(staffList) && staffList.length > 0) {
          let freeStaff: any = null;

          for (const s of staffList) {
            const ov = await hasOverlap(
              supabase,
              clientId,
              startISO,
              endISO,
              s.id
            );
            if (!ov) {
              freeStaff = s;
              break;
            }
          }

          if (freeStaff) {
            staffId = freeStaff.id;
            staffName = freeStaff.name;
          } else {
            // Niemand frei → alternative Zeiten vorschlagen (über alle Staffs)
            const day = new Date(startAt);
            day.setHours(0, 0, 0, 0);

            const suggestions = await findNextFreeSlots(
              supabase,
              clientId,
              null,
              day,
              durationMin,
              5
            );

            const baseQuestion =
              "Zu dieser Zeit ist kein Mitarbeiter frei. Welche andere Uhrzeit innerhalb der Öffnungszeiten passt Ihnen?";
            const question =
              suggestions.length > 0
                ? `${baseQuestion} Zum Beispiel: ${suggestions.join(
                    ", "
                  )}.`
                : baseQuestion;

            return NextResponse.json(
              {
                status: "need_info",
                missing: "time",
                question,
                suggestions,
              },
              { status: 200 }
            );
          }
        }
      }
    }

    // Falls wir nur den Wunschnamen haben, aber keinen aus der DB, trotzdem
    // für den Satz verwenden (sollte in der Praxis selten sein)
    if (!staffName && requestedStaffName) {
      staffName = requestedStaffName;
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

    // 9) Name nachfragen, falls noch fehlt
    if (needsCustomerName) {
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

    // 10) Freundliche Bestätigungsfrage (NEU mit kompletter Zusammenfassung)
    const customerPart =
      customerName && customerName.trim().length > 0
        ? ` für ${customerName.trim()}`
        : "";
    const staffPart =
      staffName && staffName.trim().length > 0
        ? ` bei ${staffName.trim()}`
        : "";

    const preview = `„${svc.title}“ am ${parsed.date} um ${parsed.time}${customerPart}${staffPart}`;
    const phrase = `Ich habe ${preview} eingetragen. Soll ich den Termin fix eintragen?`;

    return NextResponse.json(
      {
        status: "confirm",
        draftId: draft.id,
        preview,
        phrase,
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


