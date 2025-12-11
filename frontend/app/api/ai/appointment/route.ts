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
import {
  ensureConversationState,
  patchConversationState,
  clearConversationState,
  type AppointmentCS,
} from "@/lib/conversation-state";

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
    const {
      message,
      clientId: bodyClientId,
      sessionId,
      intent: brainIntent,
      parsed: brainParsed, // aktuell noch nicht benutzt, aber fürs Upgrade da
    } = (await req.json()) as {
      message: string;
      clientId?: string | null;
      sessionId?: string | null;
      intent?: string | null;
      parsed?: any;
    };


    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "invalid_message" },
        { status: 400 }
      );
    }

    const supabase = await createClients();

    // --- Client bestimmen: entweder über clientId ODER eingeloggten User ---
    type ClientRow = { id: string; timezone: string | null; owner_user: string; };

    let client: ClientRow | null = null;

    if (bodyClientId) {
      const { data, error } = await supabase
        .from("clients")
        .select("id, timezone, owner_user")
        .eq("id", bodyClientId)
        .maybeSingle();

      if (error) {
        console.error("[APPOINTMENT] client load error (by clientId)", error);
        return NextResponse.json(
          { error: "client_load_failed" },
          { status: 500 }
        );
      }
      if (!data) {
        return NextResponse.json(
          { error: "client_not_found" },
          { status: 404 }
        );
      }

      client = data;
    } else {
      const userId = await getCurrentUserId(supabase);
      if (!userId) {
        return NextResponse.json(
          { error: "unauthenticated" },
          { status: 401 }
        );
      }

      const { data, error } = await supabase
        .from("clients")
        .select("id, timezone, owner_user")
        .eq("owner_user", userId)
        .maybeSingle();

      if (error) {
        console.error("[APPOINTMENT] client load error (by user)", error);
        return NextResponse.json(
          { error: "client_load_failed" },
          { status: 500 }
        );
      }
      if (!data) {
        return NextResponse.json(
          { error: "no_client_for_user" },
          { status: 404 }
        );
      }

      client = data;
    }

    const clientId = client.id as string;
    const ownerUserId = client.owner_user as string; 
    const timezone = client.timezone || "Europe/Berlin";

    // ------------------------------------------------------------
    // Conversation State für diesen Call (Session) laden
    // ------------------------------------------------------------
    const sessionKey = sessionId || "single-session";

    let conv: any = null;
    let convState: { lastIntent?: string; appointment?: AppointmentCS } = {};
    let appointmentState: AppointmentCS = {};

    try {
      conv = await ensureConversationState({
        supabase,
        clientId,
        sessionId: sessionKey,
      });

      convState = (conv.state as any) || {};
      appointmentState = convState.appointment || {};
    } catch (err) {
      console.warn("[APPOINTMENT] conversation_state_load_failed", err);
    }

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

    // Intent: wenn das Brain schon einen Intent (z.B. "appointment_confirm")
    // gesetzt hat, gewinnt der → kein zweites Raten.
    let intent = (parsed?.intent || "none").toLowerCase();
    if (brainIntent) {
      intent = brainIntent.toLowerCase();
    }



// ------------------------------------------------------------------
// CASE 1: INFO – "Wann ist mein Termin?" (CSH-ready)
// ------------------------------------------------------------------
if (intent === "appointment_info") {
  // Basis aus CSH + neue Infos aus diesem Turn mergen
  let nextAppointment: AppointmentCS = {
    ...(appointmentState || {}),
    mode: "info",
  };

  // neue Daten aus diesem Turn übernehmen
  if (parsed.customer_name) {
    nextAppointment.customerName = String(parsed.customer_name).trim();
  }
  if (parsed.customer_phone) {
    nextAppointment.phone = String(parsed.customer_phone).trim();
  }

  const customerName: string | null =
    nextAppointment.customerName && nextAppointment.customerName.trim().length > 0
      ? nextAppointment.customerName.trim()
      : null;

  const customerPhone: string | null =
    nextAppointment.phone && nextAppointment.phone.trim().length > 0
      ? nextAppointment.phone.trim()
      : null;

  // Wenn weder Name noch Telefon bekannt → nach Name fragen + State speichern
  if (!customerName && !customerPhone) {
    if (conv) {
      await patchConversationState({
        supabase,
        id: conv.id,
        patch: {
          ...convState,
          lastIntent: intent,
          appointment: nextAppointment,
        },
      });
    }

    return NextResponse.json(
      {
        status: "need_info",
        missing: "customer_name",
        question: "Auf welchen Namen ist der Termin eingetragen?",
      },
      { status: 200 }
    );
  }

  // Ab hier ist mindestens Name oder Telefonnummer vorhanden
  const nowISO = new Date().toISOString();

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

  const { data: nextAppt, error: infoErr } = await query
    .order("start_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (infoErr) {
    console.error("[APPOINTMENT INFO] query error", infoErr);
  }

  if (!nextAppt) {
    // Flow ist faktisch beendet → CSH aufräumen
    if (conv) {
      try {
        await clearConversationState({
          supabase,
          clientId,
          sessionId: sessionKey,
        });
      } catch (err) {
        console.warn("[APPOINTMENT INFO] clearConversationState (none) failed", err);
      }
    }

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

  // Erfolg → State für diese Session aufräumen
  if (conv) {
    try {
      await clearConversationState({
        supabase,
        clientId,
        sessionId: sessionKey,
      });
    } catch (err) {
      console.warn("[APPOINTMENT INFO] clearConversationState (success) failed", err);
    }
  }

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
// CASE 2: CANCEL – bestehenden Termin stornieren (CSH-ready)
// ------------------------------------------------------------------
if (intent === "cancel_appointment") {
  // Basis aus CSH + neue Infos aus diesem Turn mergen
  let nextAppointment: AppointmentCS = {
    ...(appointmentState || {}),
    mode: "cancel",
  };

  // Neue Daten aus diesem Turn einpflegen (mit Validierung)
  if (parsed.date) {
    if (isISODate(parsed.date)) {
      nextAppointment.date = parsed.date;
    } else {
      nextAppointment.date = null;
    }
  }

  if (parsed.time) {
    if (isTimeHM(parsed.time)) {
      nextAppointment.time = parsed.time;
    } else {
      nextAppointment.time = null;
    }
  }

  if (parsed.customer_name) {
    nextAppointment.customerName = parsed.customer_name;
  }

  const date: string | null = nextAppointment.date ?? null;
  const time: string | null = nextAppointment.time ?? null;
  const customerName: string | null = nextAppointment.customerName ?? null;

  // --- fehlende Infos nacheinander nachfragen + State patchen ---

  // 1) Datum fehlt/ungültig
  if (!date || !isISODate(date)) {
    if (conv) {
      await patchConversationState({
        supabase,
        id: conv.id,
        patch: {
          ...convState,
          lastIntent: intent,
          appointment: nextAppointment,
        },
      });
    }

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

  // 2) Uhrzeit fehlt/ungültig
  if (!time || !isTimeHM(time)) {
    if (conv) {
      await patchConversationState({
        supabase,
        id: conv.id,
        patch: {
          ...convState,
          lastIntent: intent,
          appointment: nextAppointment,
        },
      });
    }

    return NextResponse.json(
      {
        status: "need_info",
        missing: "time",
        question:
          "Um wie viel Uhr war der Termin, den Sie stornieren möchten? (HH:MM)",
      },
      { status: 200 }
    );
  }

  // 3) Name fehlt
  if (!customerName) {
    if (conv) {
      await patchConversationState({
        supabase,
        id: conv.id,
        patch: {
          ...convState,
          lastIntent: intent,
          appointment: nextAppointment,
        },
      });
    }

    return NextResponse.json(
      {
        status: "need_info",
        missing: "customer_name",
        question: "Auf welchen Namen ist der Termin eingetragen?",
      },
      { status: 200 }
    );
  }

  // ----------------------------------------------------------------
  // Ab hier haben wir: date, time, customerName → ursprüngliche Logik
  // ----------------------------------------------------------------

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

  if (apptErr) {
    console.error("[CANCEL] query error", apptErr);
  }

  if (apptErr || !appt) {
    // Konversation aufräumen – es gibt keinen passenden Termin
    if (conv) {
      try {
        await clearConversationState({
          supabase,
          clientId,
          sessionId: sessionKey,
        });
      } catch (err) {
        console.warn("[CANCEL] clearConversationState (not_found) failed", err);
      }
    }

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
      const { oauth2 } = await getOAuth2ForUser(ownerUserId);
      const calendar = google.calendar({ version: "v3", auth: oauth2 });
      await calendar.events.delete({
        calendarId: "primary",
        eventId: appt.google_event_id,
      });
    } catch (e) {
      console.error("google cancel failed:", e);
    }
  }

  const { data: updated, error: updErr } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
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

  // nach erfolgreicher Stornierung CSH aufräumen
  if (conv) {
    try {
      await clearConversationState({
        supabase,
        clientId,
        sessionId: sessionKey,
      });
    } catch (err) {
      console.warn("[CANCEL] clearConversationState (success) failed", err);
    }
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
// CASE 3: RESCHEDULE – Termin verschieben (CSH-ready)
// ------------------------------------------------------------------
if (intent === "reschedule_appointment") {
  // Basis aus CSH + neue Infos aus diesem Turn mergen
  let nextAppointment: AppointmentCS = {
    ...(appointmentState || {}),
    mode: "reschedule",
  };

  if (parsed.new_date) {
    if (isISODate(parsed.new_date)) {
      nextAppointment.date = parsed.new_date;
    } else {
      nextAppointment.date = null;
    }
  }

  if (parsed.new_time) {
    if (isTimeHM(parsed.new_time)) {
      nextAppointment.time = parsed.new_time;
    } else {
      nextAppointment.time = null;
    }
  }

  if (parsed.customer_name) {
    nextAppointment.customerName = parsed.customer_name;
  }

  const newDate: string | null = nextAppointment.date ?? null;
  const newTime: string | null = nextAppointment.time ?? null;
  const customerName: string | null = nextAppointment.customerName ?? null;

  // --- fehlende Infos nacheinander nachfragen + State patchen ---

  // 1) Name fehlt
  if (!customerName) {
    if (conv) {
      await patchConversationState({
        supabase,
        id: conv.id,
        patch: {
          ...convState,
          lastIntent: intent,
          appointment: nextAppointment,
        },
      });
    }

    return NextResponse.json(
      {
        status: "need_info",
        missing: "customer_name",
        question: "Auf welchen Namen ist der aktuelle Termin eingetragen?",
      },
      { status: 200 }
    );
  }

  // 2) neues Datum fehlt/ungültig
  if (!newDate || !isISODate(newDate)) {
    if (conv) {
      await patchConversationState({
        supabase,
        id: conv.id,
        patch: {
          ...convState,
          lastIntent: intent,
          appointment: nextAppointment,
        },
      });
    }

    return NextResponse.json(
      {
        status: "need_info",
        missing: "new_date",
        question:
          "Auf welches Datum möchten Sie den Termin verschieben? (YYYY-MM-DD)",
      },
      { status: 200 }
    );
  }

  // 3) neue Uhrzeit fehlt/ungültig
  if (!newTime || !isTimeHM(newTime)) {
    if (conv) {
      await patchConversationState({
        supabase,
        id: conv.id,
        patch: {
          ...convState,
          lastIntent: intent,
          appointment: nextAppointment,
        },
      });
    }

    return NextResponse.json(
      {
        status: "need_info",
        missing: "new_time",
        question:
          "Auf welche Uhrzeit möchten Sie den Termin verschieben? (HH:MM, 24h)?",
      },
      { status: 200 }
    );
  }

  // ----------------------------------------------------------------
  // Ab hier haben wir: customerName, newDate, newTime → alte Logik
  // ----------------------------------------------------------------

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
    // Konversation beenden → State clearen
    if (conv) {
      try {
        await clearConversationState({
          supabase,
          clientId,
          sessionId: sessionKey,
        });
      } catch (err) {
        console.warn("[RESCHEDULE] clearConversationState (no appt) failed", err);
      }
    }

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
    if (conv) {
      await patchConversationState({
        supabase,
        id: conv.id,
        patch: {
          ...convState,
          lastIntent: intent,
          appointment: nextAppointment,
        },
      });
    }

    return NextResponse.json(
      {
        status: "need_info",
        missing: "new_date",
        question:
          "Das neue Datum liegt in der Vergangenheit. Auf welches zukünftige Datum möchten Sie verschieben? (YYYY-MM-DD)",
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
        ? "An dem Tag ist geschlossen. Haben Sie einen anderen Tag im Kopf?"
        : "Die Uhrzeit liegt außerhalb der Öffnungszeiten. Welche Zeit innerhalb der Öffnungszeiten passt Ihnen?";

    if (conv) {
      await patchConversationState({
        supabase,
        id: conv.id,
        patch: {
          ...convState,
          lastIntent: intent,
          appointment: nextAppointment,
        },
      });
    }

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

    if (conv) {
      await patchConversationState({
        supabase,
        id: conv.id,
        patch: {
          ...convState,
          lastIntent: intent,
          appointment: nextAppointment,
        },
      });
    }

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
      const { oauth2 } = await getOAuth2ForUser(ownerUserId);
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

  // nach erfolgreichem Verschieben CSH aufräumen
  if (conv) {
    try {
      await clearConversationState({
        supabase,
        clientId,
        sessionId: sessionKey,
      });
    } catch (err) {
      console.warn("[RESCHEDULE] clearConversationState (success) failed", err);
    }
  }

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
// CASE 4: AVAILABILITY – freie Zeiten abfragen (CSH-ready)
// ------------------------------------------------------------------
if (intent === "availability" || intent === "staff_availability") {
  const durationMin: number = parsed.duration_min ?? 30;
  const requestedStaffName: string | null =
    parsed.preferred_staff ?? (parsed as any).staff ?? null;

  // Basis-State aus CSH laden + neue Infos aus diesem Turn mergen
  let nextAppointment: AppointmentCS = {
    ...(appointmentState || {}),
    mode: "info",
  };

  if (parsed.date) {
    if (isISODate(parsed.date)) {
      nextAppointment.date = parsed.date;
    } else {
      nextAppointment.date = null;
    }
  }

  if (requestedStaffName) {
    nextAppointment.staffName = requestedStaffName;
  }

  const date: string | null = nextAppointment.date ?? null;

  // 1) Datum fehlt oder ist ungültig → nachfragen
  if (!date || !isISODate(date)) {
    if (conv) {
      await patchConversationState({
        supabase,
        id: conv.id,
        patch: {
          ...convState,
          lastIntent: intent,
          appointment: nextAppointment,
        },
      });
    }

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
  let staffName: string | null = nextAppointment.staffName ?? null;

  // 2) staff_availability → Mitarbeitername notwendig
  if (intent === "staff_availability") {
    if (!staffName) {
      if (conv) {
        await patchConversationState({
          supabase,
          id: conv.id,
          patch: {
            ...convState,
            lastIntent: intent,
            appointment: nextAppointment,
          },
        });
      }

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
      .ilike("name", staffName)
      .maybeSingle();

    if (!staffRow) {
      if (conv) {
        await patchConversationState({
          supabase,
          id: conv.id,
          patch: {
            ...convState,
            lastIntent: intent,
            appointment: nextAppointment,
          },
        });
      }

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

    // State updaten, jetzt wo wir einen validen Staff haben
    nextAppointment.staffId = staffId;
    nextAppointment.staffName = staffName;
  }

  const windowStart: string | null = parsed.window_start ?? null;
  const windowEnd: string | null = parsed.window_end ?? null;
  const windowStartMin =
    windowStart && isTimeHM(windowStart) ? hmToMinutes(windowStart) : null;
  const windowEndMin =
    windowEnd && isTimeHM(windowEnd) ? hmToMinutes(windowEnd) : null;

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

    // Optional: State patchen, damit der Agent ggf. darauf Bezug nehmen kann
    if (conv) {
      await patchConversationState({
        supabase,
        id: conv.id,
        patch: {
          ...convState,
          lastIntent: intent,
          appointment: nextAppointment,
        },
      });
    }

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

  // Optional: letzten Stand speichern – schadet nicht
  if (conv) {
    await patchConversationState({
      supabase,
      id: conv.id,
      patch: {
        ...convState,
        lastIntent: intent,
        appointment: nextAppointment,
      },
    });
  }

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

    
   

// *** NEUER CASE: Nutzer bestätigt den Termin ***
// Intent kommt vom Brain als "appointment_confirm"
if (intent === "appointment_confirm") {
  // 1) passenden Draft holen → bevorzugt aus CSH, sonst letzter Draft
  const draftIdFromState = appointmentState?.draftId ?? null;

  let query = supabase
    .from("appointment_drafts")
    .select("*")
    .eq("client_id", clientId);

  if (draftIdFromState) {
    query = query.eq("id", draftIdFromState);
  } else {
    query = query.order("created_at", { ascending: false }).limit(1);
  }

  const { data: draft, error: dErr } = await query.maybeSingle();

  if (dErr || !draft) {
    console.error("[APPOINTMENT CONFIRM] draft load error", dErr);
    return NextResponse.json(
      {
        status: "error",
        error: "no_draft",
        details: dErr?.message,
      },
      { status: 404 }
    );
  }

  // ... ab hier dein bestehender Code (Business-Hours-Check, Overlap, Insert etc.)


  const startAt = new Date(draft.start_at);
  const endAt = new Date(draft.end_at);

  // 2) Safety-Checks
  if (!(await isWithinBusinessHours(supabase, clientId, startAt, endAt))) {
    return NextResponse.json(
      { status: "error", error: "outside_business_hours" },
      { status: 409 }
    );
  }

  if (await hasOverlap(supabase, clientId, draft.start_at, draft.end_at)) {
    return NextResponse.json(
      { status: "error", error: "slot_taken" },
      { status: 409 }
    );
  }

  // 3) Termin in DB eintragen
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
      staff_id: draft.staff_id,
      customer_name: draft.customer_name,
      customer_phone: draft.customer_phone,
    })
    .select()
    .limit(1);

  if (aErr || !appts || !appts[0]) {
    console.error("[APPOINTMENT CONFIRM] db_insert_failed", aErr);
    return NextResponse.json(
      { status: "error", error: "db_insert_failed", details: aErr?.message },
      { status: 500 }
    );
  }

  const appointment = appts[0];

  // 4) Google Event versuchen
  let googleEventId: string | undefined = undefined;
  let calendarSynced = false;
  let calendarError: string | null = null;

  try {
    const { oauth2 } = await getOAuth2ForUser(ownerUserId);
    const calendar = google.calendar({ version: "v3", auth: oauth2 });

    const ins = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: appointment.title,
        description: "Erstellt durch ReceptaAI",
        start: { dateTime: appointment.start_at, timeZone: "Europe/Berlin" },
        end: { dateTime: appointment.end_at, timeZone: "Europe/Berlin" },
      },
    });

    if (ins.data.id) {
      googleEventId = ins.data.id;
      await supabase
        .from("appointments")
        .update({ google_event_id: ins.data.id })
        .eq("id", appointment.id);

      calendarSynced = true;
    }
  } catch (gErr: any) {
    console.error("[APPOINTMENT CONFIRM] google_insert_failed", gErr);
    calendarError =
      gErr instanceof Error ? gErr.message : String(gErr ?? "unknown");
  }

  // 5) Draft löschen
  await supabase
    .from("appointment_drafts")
    .delete()
    .eq("id", draft.id);

  // 6) Schönen Bestätigungssatz bauen (wie in confirm/route.ts)
  const start = new Date(appointment.start_at);
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

  const say = `Alles klar. Ich habe den Termin für ${appointment.customer_name ?? "Sie"} am ${dateStr} um ${timeStr} eingetragen.`;

  // 5) Conversation State für diese Session aufräumen
  if (conv) {
    try {
      await clearConversationState({
        supabase,
        clientId,
        sessionId: sessionKey,
      });
    } catch (err) {
      console.warn("[APPOINTMENT CONFIRM] clearConversationState failed", err);
    }
  }

  return NextResponse.json(
    {
      status: "confirmed",
      appointment,
      calendarSynced,
      calendarError,
    },
    { status: 200 }
  );

}

// ------------------------------------------------------------------
// CASE 5: CREATE – neuer Termin (CSH-ready)
// ------------------------------------------------------------------

if (intent !== "create_appointment") {
  // keine Termin-Intention
  return NextResponse.json({ status: "none" }, { status: 200 });
}

// 1) Bisherigen State + neue Infos aus diesem Turn mergen
let nextAppointment: AppointmentCS = {
  ...(appointmentState || {}),
};

// neue Slots aus diesem Turn
if (parsed.service) {
  nextAppointment.serviceName = parsed.service;
}
if (parsed.date) {
  if (isISODate(parsed.date)) {
    nextAppointment.date = parsed.date;
  } else {
    // ungültiges Datum → nicht übernehmen
    nextAppointment.date = null;
  }
}
if (parsed.time) {
  if (isTimeHM(parsed.time)) {
    nextAppointment.time = parsed.time;
  } else {
    // ungültige Zeit → nicht übernehmen
    nextAppointment.time = null;
  }
}
if (parsed.customer_name) {
  nextAppointment.customerName = parsed.customer_name;
}
if (parsed.customer_phone) {
  nextAppointment.phone = parsed.customer_phone;
}

const requestedStaffName: string | null =
  parsed.preferred_staff ?? (parsed as any).staff ?? null;
if (requestedStaffName) {
  nextAppointment.staffName = requestedStaffName;
}

// 2) Fehlende Kern-Infos (service / date / time)

// Service fehlt
if (!nextAppointment.serviceName) {
  if (conv) {
    await patchConversationState({
      supabase,
      id: conv.id,
      patch: {
        ...convState,
        lastIntent: intent,
        appointment: nextAppointment,
      },
    });
  }

  return NextResponse.json(
    {
      status: "need_info",
      missing: "service",
      question:
        "Für welche Leistung möchten Sie buchen? (z. B. Haarschnitt, Färben, Maniküre)",
    },
    { status: 200 }
  );
}

// Datum fehlt
if (!nextAppointment.date) {
  if (conv) {
    await patchConversationState({
      supabase,
      id: conv.id,
      patch: {
        ...convState,
        lastIntent: intent,
        appointment: nextAppointment,
      },
    });
  }

  return NextResponse.json(
    {
      status: "need_info",
      missing: "date",
      question: "An welchem Tag möchten Sie den Termin? (YYYY-MM-DD)",
    },
    { status: 200 }
  );
}

// Uhrzeit fehlt
if (!nextAppointment.time) {
  if (conv) {
    await patchConversationState({
      supabase,
      id: conv.id,
      patch: {
        ...convState,
        lastIntent: intent,
        appointment: nextAppointment,
      },
    });
  }

  return NextResponse.json(
    {
      status: "need_info",
      missing: "time",
      question: "Welche Uhrzeit passt Ihnen? (HH:MM, 24h)",
    },
    { status: 200 }
  );
}

const serviceText: string = nextAppointment.serviceName!;
const dateStr: string = nextAppointment.date!;
const timeStr: string = nextAppointment.time!;

// 3) Schnell-Check – ist an dem Tag überhaupt offen?
const testDate = new Date(`${dateStr}T12:00:00`);
const weekday = testDate.getDay();

const { data: dayHours, error: dayErr } = await supabase
  .from("business_hours")
  .select("is_closed")
  .eq("client_id", clientId)
  .eq("weekday", weekday)
  .maybeSingle();

if (!dayErr && dayHours?.is_closed) {
  if (conv) {
    await patchConversationState({
      supabase,
      id: conv.id,
      patch: {
        ...convState,
        lastIntent: intent,
        appointment: nextAppointment,
      },
    });
  }

  return NextResponse.json(
    {
      status: "need_info",
      missing: "date",
      question:
        "An dem Tag ist geschlossen. Haben Sie einen anderen Tag im Kopf?",
    },
    { status: 200 }
  );
}

// 4) Service mappen
const svc = await getServiceByMessage(supabase, clientId, serviceText || "");
if (!svc) {
  if (conv) {
    await patchConversationState({
      supabase,
      id: conv.id,
      patch: {
        ...convState,
        lastIntent: intent,
        appointment: nextAppointment,
      },
    });
  }

  return NextResponse.json(
    {
      status: "need_info",
      missing: "service",
      question:
        "Für welche Leistung möchten Sie genau buchen? (z. B. Haarschnitt, Färben, Maniküre)",
    },
    { status: 200 }
  );
}

const durationMin = svc.durationMin ?? 30;

// 4b) Kundendaten
const customerName: string | null = nextAppointment.customerName ?? null;
const customerPhone: string | null = nextAppointment.phone ?? null;
const needsCustomerName = !customerName;

// 5) Start/Ende bestimmen
const startLocal = `${dateStr}T${timeStr}:00`;
const startAt = new Date(startLocal);
const now = new Date();
if (startAt.getTime() <= now.getTime()) {
  if (conv) {
    await patchConversationState({
      supabase,
      id: conv.id,
      patch: {
        ...convState,
        lastIntent: intent,
        appointment: nextAppointment,
      },
    });
  }

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
  if (conv) {
    await patchConversationState({
      supabase,
      id: conv.id,
      patch: {
        ...convState,
        lastIntent: intent,
        appointment: nextAppointment,
      },
    });
  }

  if (hoursResult.reason === "closed") {
    return NextResponse.json(
      {
        status: "need_info",
        missing: "date",
        question:
          "An dem Tag ist geschlossen. Haben Sie einen anderen Tag im Kopf?",
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

// 7) STAFF-LOGIK
let staffId: string | null = null;
let staffName: string | null = nextAppointment.staffName ?? null;

// 7a) Wenn Kunde explizit Mitarbeiter genannt hat → diesen suchen
if (requestedStaffName) {
  const { data: staffRow } = await supabase
    .from("staff")
    .select("id, name")
    .eq("client_id", clientId)
    .ilike("name", requestedStaffName)
    .maybeSingle();

  if (!staffRow) {
    if (conv) {
      await patchConversationState({
        supabase,
        id: conv.id,
        patch: {
          ...convState,
          lastIntent: intent,
          appointment: nextAppointment,
        },
      });
    }

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

    if (conv) {
      await patchConversationState({
        supabase,
        id: conv.id,
        patch: {
          ...convState,
          lastIntent: intent,
          appointment: nextAppointment,
        },
      });
    }

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
            ? `${baseQuestion} Zum Beispiel: ${suggestions.join(", ")}.`
            : baseQuestion;

        if (conv) {
          await patchConversationState({
            supabase,
            id: conv.id,
            patch: {
              ...convState,
              lastIntent: intent,
              appointment: nextAppointment,
            },
          });
        }

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
// für den Satz verwenden
if (!staffName && requestedStaffName) {
  staffName = requestedStaffName;
}

// 8) Draft speichern
console.log("[APPOINTMENT] BEFORE_DRAFT_INSERT", {
  ownerUserId,
  clientId,
  svc,
  startISO,
  endISO,
  staffId,
});

const { data: draft, error: dErr } = await supabase
  .from("appointment_drafts")
  .insert({
    user_id: ownerUserId,
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

// 9) CSH aktualisieren (inkl. draftId)
if (conv) {
  const nextStateAfterDraft: AppointmentCS = {
    ...nextAppointment,
    mode: "booking",
    draftId: draft.id,
    serviceId: svc.id,
    serviceName: svc.title,
    staffId,
    staffName,
    customerName,
    phone: customerPhone,
  };

  await patchConversationState({
    supabase,
    id: conv.id,
    patch: {
      ...convState,
      lastIntent: intent,
      appointment: nextStateAfterDraft,
    },
  });

  // Lokales nextAppointment für den Rest auch updaten
  nextAppointment = nextStateAfterDraft;
}

// 10) Name nachfragen, falls noch fehlt
if (needsCustomerName) {
  return NextResponse.json(
    {
      status: "need_info",
      missing: "customer_name",
      question: "Auf welchen Namen darf ich den Termin eintragen?",
      draftId: draft.id,
    },
    { status: 200 }
  );
}

// 11) Freundliche Bestätigungsfrage
const customerPart =
  customerName && customerName.trim().length > 0
    ? ` für ${customerName.trim()}`
    : "";
const staffPart =
  staffName && staffName.trim().length > 0
    ? ` bei ${staffName.trim()}`
    : "";

const preview = `„${svc.title}“ am ${dateStr} um ${timeStr}${customerPart}${staffPart}`;
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


