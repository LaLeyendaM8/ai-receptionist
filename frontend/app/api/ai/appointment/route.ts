// app/api/ai/appointment/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClients, createServiceClient } from "@/lib/supabaseClients";
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
import { DateTime } from "luxon";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function toZoned(date: Date, tz: string) {
  return DateTime.fromJSDate(date, { zone: tz });
}

// Baut ein “lokales” Datum+Zeit in tz und gibt dir UTC-ISO fürs Speichern
function localDateTimeToUTCISO(dateStr: string, timeStr: string, tz: string) {
  const dt = DateTime.fromISO(`${dateStr}T${timeStr}:00`, { zone: tz });
  if (!dt.isValid) return null;
  return dt.toUTC().toISO({ suppressMilliseconds: true });
}

// Nur für “welcher Wochentag ist das in tz”
function weekdayInTZ(dateStr: string, tz: string) {
  const dt = DateTime.fromISO(dateStr, { zone: tz });
  // Luxon: 1=Mon ... 7=Sun → wir brauchen 0=Sun ... 6=Sat
  return dt.weekday % 7;
}

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
  day: Date,
  tz: string
) {
  // Wochentag TZ-safe
  const weekday = toZoned(day, tz).weekday % 7;

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

// HH:MM → Minuten seit Mitternacht
function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

type ApptInterval = { start_at: string; end_at: string };

function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart;
}

// Key: clientId|staffId|windowStartISO|windowEndISO


function makeOverlapKey(
  clientId: string,
  staffId: string | null,
  windowStartISO: string,
  windowEndISO: string
) {
  return `${clientId}|${staffId ?? "none"}|${windowStartISO}|${windowEndISO}`;
}

async function prefetchOverlaps(
  supabase: SupabaseClient,
  overlapCache: Map<string, ApptInterval[]>,
  clientId: string,
  staffId: string | null,
  windowStartISO: string,
  windowEndISO: string
) {
  const key = makeOverlapKey(clientId, staffId, windowStartISO, windowEndISO);
  if (overlapCache.has(key)) return key;

  let q = supabase
    .from("appointments")
    .select("start_at,end_at")
    .eq("client_id", clientId)
    .neq("status", "cancelled")
    // alle die ins Fenster reinragen
    .lt("start_at", windowEndISO)
    .gt("end_at", windowStartISO);

  if (staffId) q = q.eq("staff_id", staffId);

  const { data, error } = await q;
  if (error) {
    console.error("[AVAIL] prefetchOverlaps error", error);
    overlapCache.set(key, []);
    return key;
  }

  overlapCache.set(key, (data ?? []) as ApptInterval[]);
  return key;
}

/**
 * Freie Slots für einen Tag (minutengenau, z. B. in 15-Minuten-Schritten).
 * Gibt eine Liste von Uhrzeiten als String ("HH:MM") in Europe/Berlin (bzw. client tz) zurück.
 */
async function findNextFreeSlots(
  supabase: SupabaseClient,
  overlapCache: Map<string, ApptInterval[]>,
  clientId: string,
  staffId: string | null,
  day: Date,
  durationMin: number,
  tz: string,
  maxSuggestions = 3,
  windowStartMin?: number,
  windowEndMin?: number
) {
  const suggestions: string[] = [];

  // Day start in TZ (nicht server-local!)
  const dayStartTZ = toZoned(day, tz).startOf("day");

  // 1) Öffnungszeiten
  const hours = await getBusinessHoursForDay(
    supabase,
    clientId,
    dayStartTZ.toJSDate(),
    tz
  );
  if (!hours || hours.is_closed) return suggestions;

  let startMinute = hours.open_min;
  let endMinute = hours.close_min;

  // 2) User-Zeitfenster clampen
  if (typeof windowStartMin === "number" && windowStartMin > startMinute) {
    startMinute = windowStartMin;
  }
  if (typeof windowEndMin === "number" && windowEndMin < endMinute) {
    endMinute = windowEndMin;
  }

  // Fenster-Start/Ende als UTC ISO (für Prefetch-Query)
  const windowStartISO = dayStartTZ
    .plus({ minutes: startMinute })
    .toUTC()
    .toISO({ suppressMilliseconds: true })!;
  const windowEndISO = dayStartTZ
    .plus({ minutes: endMinute })
    .toUTC()
    .toISO({ suppressMilliseconds: true })!;

  // 3) EINMAL alle Termine fürs Fenster cachen
  await prefetchOverlaps(supabase, overlapCache, clientId, staffId, windowStartISO, windowEndISO);
  const cacheKey = makeOverlapKey(clientId, staffId, windowStartISO, windowEndISO);
  const existing = overlapCache.get(cacheKey) ?? [];

  // 4) Iterate candidates, check overlap in-memory
  for (
    let m = startMinute;
    m + durationMin <= endMinute && suggestions.length < maxSuggestions;
    m += 15
  ) {
    const cStartISO = dayStartTZ
      .plus({ minutes: m })
      .toUTC()
      .toISO({ suppressMilliseconds: true })!;
    const cEndISO = DateTime.fromISO(cStartISO)
      .plus({ minutes: durationMin })
      .toUTC()
      .toISO({ suppressMilliseconds: true })!;

    const cStart = new Date(cStartISO);
    const cEnd = new Date(cEndISO);

    const hasOverlap = existing.some((a) =>
      intervalsOverlap(cStart, cEnd, new Date(a.start_at), new Date(a.end_at))
    );

    if (!hasOverlap) {
      const localLabel = DateTime.fromISO(cStartISO, { zone: "utc" })
        .setZone(tz)
        .toFormat("HH:mm");
      suggestions.push(localLabel);
    }
  }

  return suggestions;
}

// Overlap-Check inkl. optional staff_id
async function hasOverlap(
  supabase: SupabaseClient,
  overlapCache : Map<string, ApptInterval[]>,
  clientId: string,
  startISO: string,
  endISO: string,
  staffId?: string
): Promise<boolean> {
  // Minimal: wir nehmen den ganzen UTC-Tag um startISO herum (ok fürs MVP)
  const day = new Date(startISO);
  day.setUTCHours(0, 0, 0, 0);

  const windowStart = new Date(day);
  const windowEnd = new Date(day);
  windowEnd.setUTCHours(23, 59, 59, 999);

  const windowStartISO = windowStart.toISOString();
  const windowEndISO = windowEnd.toISOString();

  await prefetchOverlaps(
    supabase,
    overlapCache,
    clientId,
    staffId ?? null,
    windowStartISO,
    windowEndISO
  );

  const key = makeOverlapKey(clientId, staffId ?? null, windowStartISO, windowEndISO);
  const existing = overlapCache.get(key) ?? [];

  const cStart = new Date(startISO);
  const cEnd = new Date(endISO);

  return existing.some((a) =>
    intervalsOverlap(cStart, cEnd, new Date(a.start_at), new Date(a.end_at))
  );
}

type HoursResult =
  | { ok: true }
  | { ok: false; reason: "no_hours" | "closed" | "outside" };

export async function isWithinBusinessHours(
  supabase: SupabaseClient,
  clientId: string,
  start: Date,
  end: Date,
  tz: string
): Promise<HoursResult> {
  const s = toZoned(start, tz);
  const e = toZoned(end, tz);

  const weekday = s.weekday % 7; // 0..6 (Sun..Sat)

  const { data: hours, error } = await supabase
    .from("business_hours")
    .select("weekday, open_min, close_min, is_closed")
    .eq("client_id", clientId)
    .eq("weekday", weekday)
    .maybeSingle();

  if (error) return { ok: false, reason: "no_hours" };
  if (!hours) return { ok: false, reason: "no_hours" };
  if (hours.is_closed) return { ok: false, reason: "closed" };

  const sMin = s.hour * 60 + s.minute;
  const eMin = e.hour * 60 + e.minute;

  if (sMin < hours.open_min || eMin > hours.close_min) {
    return { ok: false, reason: "outside" };
  }

  return { ok: true };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      message: string;
      clientId?: string | null;
      sessionId?: string | null;
      intent?: string | null;
      parsed?: any;
    };

    const {
      message,
      clientId: bodyClientId,
      sessionId,
      intent: brainIntent,
    } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "invalid_message" }, { status: 400 });
    }

    // ✅ supabase client bestimmen: clientId => ServiceClient, sonst Cookie Client
    const supabase = bodyClientId ? createServiceClient() : await createClients();
    const overlapCache = new Map<string, ApptInterval[]>();
    // --- Client bestimmen: entweder über clientId ODER eingeloggten User ---
    type ClientRow = {
      id: string;
      timezone: string | null;
      owner_user: string;
      staff_enabled: boolean | null;
    };

    let client: ClientRow | null = null;

    if (bodyClientId) {
      const { data, error } = await supabase
        .from("clients")
        .select("id, timezone, owner_user, staff_enabled")
        .eq("id", bodyClientId)
        .maybeSingle();

      if (error) {
        console.error("[APPOINTMENT] client load error (by clientId)", error);
        return NextResponse.json({ error: "client_load_failed" }, { status: 500 });
      }
      if (!data) {
        return NextResponse.json({ error: "client_not_found" }, { status: 404 });
      }
      client = data;
    } else {
      const userId = await getCurrentUserId(supabase);
      if (!userId) {
        return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
      }

      const { data, error } = await supabase
        .from("clients")
        .select("id, timezone, owner_user, staff_enabled")
        .eq("owner_user", userId)
        .maybeSingle();

      if (error) {
        console.error("[APPOINTMENT] client load error (by user)", error);
        return NextResponse.json({ error: "client_load_failed" }, { status: 500 });
      }
      if (!data) {
        return NextResponse.json({ error: "no_client_for_user" }, { status: 404 });
      }
      client = data;
    }

    const clientId = client.id as string;
    const ownerUserId = client.owner_user as string;
    const timezone = client.timezone || "Europe/Berlin";
    const staffEnabled = Boolean(client.staff_enabled);

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
      return NextResponse.json({ status: "none" }, { status: 200 });
    }

    // Intent: wenn das Brain schon einen Intent gesetzt hat, gewinnt der
    let intent = (parsed?.intent || "none").toLowerCase();
    if (brainIntent) {
      intent = brainIntent.toLowerCase();
    }

    // ------------------------------------------------------------------
    // CASE 1: INFO – "Wann ist mein Termin?"
    // ------------------------------------------------------------------
    if (intent === "appointment_info") {
      let nextAppointment: AppointmentCS = {
        ...(appointmentState || {}),
        mode: "info",
      };

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

      if (!customerName && !customerPhone) {
        if (conv) {
          await patchConversationState({
            supabase,
            id: conv.id,
            patch: { ...convState, lastIntent: intent, appointment: nextAppointment },
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

      const nowISO = new Date().toISOString();

      let query = supabase
        .from("appointments")
        .select("*")
        .eq("client_id", clientId)
        .neq("status", "cancelled")
        .gte("start_at", nowISO);

      if (customerName) query = query.eq("customer_name", customerName);
      if (customerPhone) query = query.eq("customer_phone", customerPhone);

      const { data: nextAppt, error: infoErr } = await query
        .order("start_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (infoErr) console.error("[APPOINTMENT INFO] query error", infoErr);

      if (!nextAppt) {
        if (conv) {
          try {
            await clearConversationState({ supabase, clientId, sessionId: sessionKey });
          } catch (err) {
            console.warn("[APPOINTMENT INFO] clearConversationState failed", err);
          }
        }

        return NextResponse.json(
          { status: "info_none", message: "Ich finde keinen zukünftigen Termin für Sie." },
          { status: 200 }
        );
      }

      const start = DateTime.fromISO(nextAppt.start_at, { zone: "utc" }).setZone(timezone);
      const dateStr = start.setLocale("de").toFormat("cccc, dd.MM.yyyy");
      const timeStr = start.toFormat("HH:mm");

      if (conv) {
        try {
          await clearConversationState({ supabase, clientId, sessionId: sessionKey });
        } catch (err) {
          console.warn("[APPOINTMENT INFO] clearConversationState failed", err);
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
    // CASE 2: CANCEL – bestehenden Termin stornieren
    // ------------------------------------------------------------------
    if (intent === "cancel_appointment") {
      let nextAppointment: AppointmentCS = {
        ...(appointmentState || {}),
        mode: "cancel",
      };

      if (parsed.date) nextAppointment.date = isISODate(parsed.date) ? parsed.date : null;
      if (parsed.time) nextAppointment.time = isTimeHM(parsed.time) ? parsed.time : null;
      if (parsed.customer_name) nextAppointment.customerName = parsed.customer_name;

      const date: string | null = nextAppointment.date ?? null;
      const time: string | null = nextAppointment.time ?? null;
      const customerName: string | null = nextAppointment.customerName ?? null;

      if (!date || !isISODate(date)) {
        if (conv) {
          await patchConversationState({
            supabase,
            id: conv.id,
            patch: { ...convState, lastIntent: intent, appointment: nextAppointment },
          });
        }
        return NextResponse.json(
          { status: "need_info", missing: "date", question: "Für welches Datum soll ich den Termin stornieren? (YYYY-MM-DD)" },
          { status: 200 }
        );
      }

      if (!time || !isTimeHM(time)) {
        if (conv) {
          await patchConversationState({
            supabase,
            id: conv.id,
            patch: { ...convState, lastIntent: intent, appointment: nextAppointment },
          });
        }
        return NextResponse.json(
          { status: "need_info", missing: "time", question: "Um wie viel Uhr war der Termin, den Sie stornieren möchten? (HH:MM)" },
          { status: 200 }
        );
      }

      if (!customerName) {
        if (conv) {
          await patchConversationState({
            supabase,
            id: conv.id,
            patch: { ...convState, lastIntent: intent, appointment: nextAppointment },
          });
        }
        return NextResponse.json(
          { status: "need_info", missing: "customer_name", question: "Auf welchen Namen ist der Termin eingetragen?" },
          { status: 200 }
        );
      }

      const targetISO = localDateTimeToUTCISO(date, time, timezone);
      if (!targetISO) {
        return NextResponse.json(
          { status: "need_info", missing: "time", question: "Bitte HH:MM (24h)." },
          { status: 200 }
        );
      }

      const { data: appt, error: apptErr } = await supabase
        .from("appointments")
        .select("*")
        .eq("client_id", clientId)
        .neq("status", "cancelled")
        .eq("start_at", targetISO)
        .eq("customer_name", customerName)
        .maybeSingle();

      if (apptErr) console.error("[CANCEL] query error", apptErr);

      if (apptErr || !appt) {
        if (conv) {
          try {
            await clearConversationState({ supabase, clientId, sessionId: sessionKey });
          } catch (err) {
            console.warn("[CANCEL] clearConversationState failed", err);
          }
        }
        return NextResponse.json(
          { status: "cancel_not_found", message: "Ich konnte zu diesem Zeitpunkt keinen passenden Termin finden." },
          { status: 200 }
        );
      }

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
          { status: "error", error: "cancel_update_failed", details: updErr.message },
          { status: 500 }
        );
      }

      if (!updated) {
        return NextResponse.json(
          { status: "error", error: "cancel_not_found_after_update" },
          { status: 500 }
        );
      }

      if (conv) {
        try {
          await clearConversationState({ supabase, clientId, sessionId: sessionKey });
        } catch (err) {
          console.warn("[CANCEL] clearConversationState failed", err);
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
    // CASE 3: RESCHEDULE – Termin verschieben
    // ------------------------------------------------------------------
    if (intent === "reschedule_appointment") {
      let nextAppointment: AppointmentCS = {
        ...(appointmentState || {}),
        mode: "reschedule",
      };

      if (parsed.new_date) nextAppointment.date = isISODate(parsed.new_date) ? parsed.new_date : null;
      if (parsed.new_time) nextAppointment.time = isTimeHM(parsed.new_time) ? parsed.new_time : null;
      if (parsed.customer_name) nextAppointment.customerName = parsed.customer_name;

      const newDate: string | null = nextAppointment.date ?? null;
      const newTime: string | null = nextAppointment.time ?? null;
      const customerName: string | null = nextAppointment.customerName ?? null;

      if (!customerName) {
        if (conv) {
          await patchConversationState({
            supabase,
            id: conv.id,
            patch: { ...convState, lastIntent: intent, appointment: nextAppointment },
          });
        }
        return NextResponse.json(
          { status: "need_info", missing: "customer_name", question: "Auf welchen Namen ist der aktuelle Termin eingetragen?" },
          { status: 200 }
        );
      }

      if (!newDate || !isISODate(newDate)) {
        if (conv) {
          await patchConversationState({
            supabase,
            id: conv.id,
            patch: { ...convState, lastIntent: intent, appointment: nextAppointment },
          });
        }
        return NextResponse.json(
          { status: "need_info", missing: "new_date", question: "Auf welches Datum möchten Sie den Termin verschieben? (YYYY-MM-DD)" },
          { status: 200 }
        );
      }

      if (!newTime || !isTimeHM(newTime)) {
        if (conv) {
          await patchConversationState({
            supabase,
            id: conv.id,
            patch: { ...convState, lastIntent: intent, appointment: nextAppointment },
          });
        }
        return NextResponse.json(
          { status: "need_info", missing: "new_time", question: "Auf welche Uhrzeit möchten Sie den Termin verschieben? (HH:MM, 24h)?" },
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
        if (conv) {
          try {
            await clearConversationState({ supabase, clientId, sessionId: sessionKey });
          } catch (err) {
            console.warn("[RESCHEDULE] clearConversationState failed", err);
          }
        }
        return NextResponse.json(
          {
            status: "reschedule_none",
            message: "Es ist kein zukünftiger Termin eingetragen, den ich verschieben könnte.",
          },
          { status: 200 }
        );
      }

      const oldStartUTC = DateTime.fromISO(oldAppt.start_at, { zone: "utc" });
      const oldEndUTC = DateTime.fromISO(oldAppt.end_at, { zone: "utc" });
      const durationMs = oldEndUTC.toMillis() - oldStartUTC.toMillis();

      // TZ-safe new start/end
      const newStartISO = localDateTimeToUTCISO(newDate, newTime, timezone);
      if (!newStartISO) {
        return NextResponse.json(
          { status: "need_info", missing: "new_time", question: "Bitte HH:MM (24h)." },
          { status: 200 }
        );
      }

      const newEndISO = DateTime.fromISO(newStartISO)
        .plus({ milliseconds: durationMs })
        .toUTC()
        .toISO({ suppressMilliseconds: true })!;

      const newStart = new Date(newStartISO);
      const newEnd = new Date(newEndISO);

      if (newStart.getTime() <= Date.now()) {
        if (conv) {
          await patchConversationState({
            supabase,
            id: conv.id,
            patch: { ...convState, lastIntent: intent, appointment: nextAppointment },
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

      const hoursResultReschedule = await isWithinBusinessHours(
        supabase,
        clientId,
        newStart,
        newEnd,
        timezone
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
            patch: { ...convState, lastIntent: intent, appointment: nextAppointment },
          });
        }

        return NextResponse.json(
          { status: "need_info", missing: "new_time", question: msg },
          { status: 200 }
        );
      }

      const staffIdReschedule = oldAppt.staff_id ?? null;
      const hasOverlapReschedule = await hasOverlap(
        supabase,
        overlapCache,
        clientId,
        newStartISO,
        newEndISO,
        staffIdReschedule || undefined
      );

      if (hasOverlapReschedule) {
        const dayRef = DateTime.fromISO(newStartISO, { zone: "utc" })
          .setZone(timezone)
          .startOf("day")
          .toJSDate();

        const durationMin = Math.round(durationMs / (60 * 1000));
        const suggestions = await findNextFreeSlots(
          supabase,
          overlapCache,
          clientId,
          staffIdReschedule,
          dayRef,
          durationMin,
          timezone,
          5
        );

        const baseQuestion =
          "Dieser Slot ist belegt. Eine andere Uhrzeit (z. B. 30 Min früher oder später)?";

        const question =
          suggestions.length > 0
            ? `${baseQuestion} Zum Beispiel: ${suggestions.join(", ")}. Welche Uhrzeit passt Ihnen?`
            : baseQuestion;

        if (conv) {
          await patchConversationState({
            supabase,
            id: conv.id,
            patch: { ...convState, lastIntent: intent, appointment: nextAppointment },
          });
        }

        return NextResponse.json(
          { status: "need_info", missing: "new_time", question, suggestions },
          { status: 200 }
        );
      }

      const { data: updated, error: updErr } = await supabase
        .from("appointments")
        .update({ start_at: newStartISO, end_at: newEndISO })
        .eq("id", oldAppt.id)
        .select()
        .maybeSingle();

      if (updErr || !updated) {
        return NextResponse.json(
          { error: "reschedule_failed", details: updErr?.message },
          { status: 500 }
        );
      }

      if (updated.google_event_id) {
        try {
          const { oauth2 } = await getOAuth2ForUser(ownerUserId);
          const calendar = google.calendar({ version: "v3", auth: oauth2 });
          await calendar.events.patch({
            calendarId: "primary",
            eventId: updated.google_event_id,
            requestBody: {
              start: { dateTime: newStartISO, timeZone: timezone },
              end: { dateTime: newEndISO, timeZone: timezone },
            },
          });
        } catch (e) {
          console.error("google reschedule failed:", e);
        }
      }

      const oldLocal = oldStartUTC.setZone(timezone).setLocale("de");
      const newLocal = DateTime.fromISO(newStartISO, { zone: "utc" }).setZone(timezone).setLocale("de");

      const oldDateStr = oldLocal.toFormat("cccc, dd.MM");
      const oldTimeStr = oldLocal.toFormat("HH:mm");
      const newDateStr = newLocal.toFormat("cccc, dd.MM");
      const newTimeStr = newLocal.toFormat("HH:mm");

      if (conv) {
        try {
          await clearConversationState({ supabase, clientId, sessionId: sessionKey });
        } catch (err) {
          console.warn("[RESCHEDULE] clearConversationState failed", err);
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
    // CASE 4: AVAILABILITY – freie Zeiten abfragen
    // ------------------------------------------------------------------
    if (intent === "availability" || intent === "staff_availability") {
      const durationMin: number = parsed.duration_min ?? 30;
      const requestedStaffName: string | null =
        parsed.preferred_staff ?? (parsed as any).staff ?? null;

      if (!staffEnabled && intent === "staff_availability") {
        const dateOnly = parsed.date ?? null;
        return NextResponse.json(
          {
            status: "availability",
            message:
              "Aktuell können wir leider keine Mitarbeiterwünsche annehmen. Ich kann Ihnen aber allgemeine freie Zeiten nennen – für welchen Tag möchten Sie die Verfügbarkeit wissen? (YYYY-MM-DD)",
            suggestions: [],
            staff: null,
            date: isISODate(dateOnly) ? dateOnly : null,
          },
          { status: 200 }
        );
      }

      let nextAppointment: AppointmentCS = {
        ...(appointmentState || {}),
        mode: "info",
      };

      if (parsed.date) nextAppointment.date = isISODate(parsed.date) ? parsed.date : null;
      if (requestedStaffName) nextAppointment.staffName = requestedStaffName;

      const date: string | null = nextAppointment.date ?? null;

      if (!date || !isISODate(date)) {
        if (conv) {
          await patchConversationState({
            supabase,
            id: conv.id,
            patch: { ...convState, lastIntent: intent, appointment: nextAppointment },
          });
        }
        return NextResponse.json(
          { status: "need_info", missing: "date", question: "Für welchen Tag möchten Sie die freien Zeiten wissen? (YYYY-MM-DD)" },
          { status: 200 }
        );
      }

      let staffId: string | null = null;
      let staffName: string | null = nextAppointment.staffName ?? null;

      if (intent === "staff_availability") {
        if (!staffName) {
          if (conv) {
            await patchConversationState({
              supabase,
              id: conv.id,
              patch: { ...convState, lastIntent: intent, appointment: nextAppointment },
            });
          }
          return NextResponse.json(
            {
              status: "need_info",
              missing: "staff",
              question: "Für welchen Mitarbeiter oder welche Mitarbeiterin möchten Sie die freien Zeiten wissen?",
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
              patch: { ...convState, lastIntent: intent, appointment: nextAppointment },
            });
          }
          return NextResponse.json(
            {
              status: "need_info",
              missing: "staff",
              question: "Ich habe diesen Namen nicht gefunden. Für welchen Mitarbeiter oder welche Mitarbeiterin soll ich schauen?",
            },
            { status: 200 }
          );
        }

        staffId = staffRow.id;
        staffName = staffRow.name;

        nextAppointment.staffId = staffId;
        nextAppointment.staffName = staffName;
      }

      const windowStart: string | null = parsed.window_start ?? null;
      const windowEnd: string | null = parsed.window_end ?? null;
      const windowStartMin =
        windowStart && isTimeHM(windowStart) ? hmToMinutes(windowStart) : null;
      const windowEndMin =
        windowEnd && isTimeHM(windowEnd) ? hmToMinutes(windowEnd) : null;

      // Day reference TZ-safe
      const dayRef = DateTime.fromISO(date, { zone: timezone }).set({ hour: 12 }).toJSDate();

      const suggestions = await findNextFreeSlots(
        supabase,
        overlapCache,
        clientId,
        staffId,
        dayRef,
        durationMin,
        timezone,
        3,
        windowStartMin ?? undefined,
        windowEndMin ?? undefined
      );

      if (!suggestions.length) {
        const msg = staffName
          ? `Am ${date} habe ich für ${staffName} leider keine freien Slots gefunden.`
          : `Am ${date} habe ich leider keine freien Slots gefunden.`;

        if (conv) {
          await patchConversationState({
            supabase,
            id: conv.id,
            patch: { ...convState, lastIntent: intent, appointment: nextAppointment },
          });
        }

        return NextResponse.json(
          { status: "availability_none", message: msg, suggestions: [] },
          { status: 200 }
        );
      }

      const msg = staffName
        ? `Am ${date} hätte ${staffName} z. B. folgende freie Zeiten: ${suggestions.join(", ")}.`
        : `Am ${date} hätte ich z. B. folgende freie Zeiten: ${suggestions.join(", ")}.`;

      if (conv) {
        await patchConversationState({
          supabase,
          id: conv.id,
          patch: { ...convState, lastIntent: intent, appointment: nextAppointment },
        });
      }

      return NextResponse.json(
        { status: "availability", message: msg, suggestions, staff: staffName, date },
        { status: 200 }
      );
    }

    // ------------------------------------------------------------------
    // CASE: appointment_confirm
    // ------------------------------------------------------------------
    if (intent === "appointment_confirm") {
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
          { status: "error", error: "no_draft", details: dErr?.message },
          { status: 404 }
        );
      }

      const startAt = new Date(draft.start_at);
      const endAt = new Date(draft.end_at);

      const hoursCheck = await isWithinBusinessHours(
        supabase,
        clientId,
        startAt,
        endAt,
        timezone
      );

      if (!hoursCheck.ok) {
        return NextResponse.json(
          { status: "error", error: "outside_business_hours" },
          { status: 409 }
        );
      }

      if (await hasOverlap(supabase, overlapCache,  clientId, draft.start_at, draft.end_at)) {
        return NextResponse.json(
          { status: "error", error: "slot_taken" },
          { status: 409 }
        );
      }

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
            start: { dateTime: appointment.start_at, timeZone: timezone },
            end: { dateTime: appointment.end_at, timeZone: timezone },
          },
        });

        if (ins.data.id) {
          await supabase
            .from("appointments")
            .update({ google_event_id: ins.data.id })
            .eq("id", appointment.id);

          calendarSynced = true;
        }
      } catch (gErr: any) {
        console.error("[APPOINTMENT CONFIRM] google_insert_failed", gErr);
        calendarError = gErr instanceof Error ? gErr.message : String(gErr ?? "unknown");
      }

      await supabase.from("appointment_drafts").delete().eq("id", draft.id);

      if (conv) {
        try {
          await clearConversationState({ supabase, clientId, sessionId: sessionKey });
        } catch (err) {
          console.warn("[APPOINTMENT CONFIRM] clearConversationState failed", err);
        }
      }

      return NextResponse.json(
        { status: "confirmed", appointment, calendarSynced, calendarError },
        { status: 200 }
      );
    }

    // ------------------------------------------------------------------
    // CASE 5: CREATE – neuer Termin (TZ-safe via Luxon)
    // ------------------------------------------------------------------
    if (intent !== "create_appointment") {
      return NextResponse.json({ status: "none" }, { status: 200 });
    }

    let nextAppointment: AppointmentCS = {
      ...(appointmentState || {}),
    };

    if (parsed.service) nextAppointment.serviceName = parsed.service;
    if (parsed.date) nextAppointment.date = isISODate(parsed.date) ? parsed.date : null;
    if (parsed.time) nextAppointment.time = isTimeHM(parsed.time) ? parsed.time : null;
    if (parsed.customer_name) nextAppointment.customerName = parsed.customer_name;
    if (parsed.customer_phone) nextAppointment.phone = parsed.customer_phone;

    const requestedStaffName: string | null =
      parsed.preferred_staff ?? (parsed as any).staff ?? null;
    if (requestedStaffName) nextAppointment.staffName = requestedStaffName;

    const staffNote =
      !staffEnabled && requestedStaffName
        ? "Aktuell können wir leider keine Mitarbeiterwünsche annehmen. Ich plane den Termin ohne festen Mitarbeiter. "
        : "";

    const needInfo = async (missing: string, question: string) => {
      if (conv) {
        await patchConversationState({
          supabase,
          id: conv.id,
          patch: { ...convState, lastIntent: intent, appointment: nextAppointment },
        });
      }
      return NextResponse.json({ status: "need_info", missing, question }, { status: 200 });
    };

    if (!nextAppointment.date) {
      return await needInfo("date", "An welchem Tag möchten Sie den Termin? (YYYY-MM-DD)");
    }
    if (!nextAppointment.time) {
      return await needInfo("time", "Welche Uhrzeit passt Ihnen? (HH:MM, 24h)");
    }

    const dateStr: string = nextAppointment.date!;
    const timeStr: string = nextAppointment.time!;

    // Ist an dem Tag offen? (TZ-safe)
    const weekday = weekdayInTZ(dateStr, timezone);

    const { data: dayHours, error: dayErr } = await supabase
      .from("business_hours")
      .select("is_closed")
      .eq("client_id", clientId)
      .eq("weekday", weekday)
      .maybeSingle();

    if (!dayErr && dayHours?.is_closed) {
      return await needInfo("date", "An dem Tag ist geschlossen. Haben Sie einen anderen Tag im Kopf?");
    }

    // Pre-Check: Vergangenheit + Öffnungszeiten (default 30min) TZ-safe
    const startISOpre = localDateTimeToUTCISO(dateStr, timeStr, timezone);
    if (!startISOpre) {
      return await needInfo("time", "Die Uhrzeit ist ungültig. Bitte im Format HH:MM (24h).");
    }

    const startAtPre = new Date(startISOpre);
    if (startAtPre.getTime() <= Date.now()) {
      return await needInfo(
        "date",
        "Das Datum liegt in der Vergangenheit. Welches zukünftige Datum passt Ihnen? (Bitte YYYY-MM-DD)"
      );
    }

    const preDurationMin = 30;
    const endISOpre = DateTime.fromISO(startISOpre)
      .plus({ minutes: preDurationMin })
      .toUTC()
      .toISO({ suppressMilliseconds: true })!;
    const endAtPre = new Date(endISOpre);

    const preHoursResult = await isWithinBusinessHours(
      supabase,
      clientId,
      startAtPre,
      endAtPre,
      timezone
    );

    if (!preHoursResult.ok) {
      if (preHoursResult.reason === "closed") {
        return await needInfo("date", "An dem Tag ist geschlossen. Haben Sie einen anderen Tag im Kopf?");
      }
      return await needInfo(
        "time",
        "Die Uhrzeit liegt außerhalb der Öffnungszeiten. Welche Zeit innerhalb der Öffnungszeiten passt Ihnen?"
      );
    }

    // Service abfragen/mappen
    if (!nextAppointment.serviceName) {
      return await needInfo(
        "service",
        "Für welche Leistung möchten Sie buchen? (z. B. Haarschnitt, Färben, Maniküre)"
      );
    }

    const serviceText: string = nextAppointment.serviceName!;
    const svc = await getServiceByMessage(supabase, clientId, serviceText || "");

    if (!svc) {
      return await needInfo(
        "service",
        "Für welche Leistung möchten Sie genau buchen? (z. B. Haarschnitt, Färben, Maniküre)"
      );
    }

    const durationMin = svc.durationMin ?? 30;

    // Final: Start/Ende mit echter Dauer TZ-safe
    const startISO = startISOpre;
    const endISO = DateTime.fromISO(startISO)
      .plus({ minutes: durationMin })
      .toUTC()
      .toISO({ suppressMilliseconds: true })!;

    const startAt = new Date(startISO);
    const endAt = new Date(endISO);

    const hoursResult = await isWithinBusinessHours(
      supabase,
      clientId,
      startAt,
      endAt,
      timezone
    );

    if (!hoursResult.ok) {
      if (hoursResult.reason === "closed") {
        return await needInfo("date", "An dem Tag ist geschlossen. Haben Sie einen anderen Tag im Kopf?");
      }
      return await needInfo(
        "time",
        "Die Uhrzeit liegt außerhalb der Öffnungszeiten. Welche Zeit innerhalb der Öffnungszeiten passt Ihnen?"
      );
    }

    // Kundendaten
    const customerName: string | null = nextAppointment.customerName ?? null;
    const customerPhone: string | null = nextAppointment.phone ?? null;
    const needsCustomerName = !customerName;

    // STAFF-LOGIK
    let staffId: string | null = null;
    let staffName: string | null = nextAppointment.staffName ?? null;

    if (!staffEnabled) {
      staffId = null;
      staffName = null;

      const overlapAny = await hasOverlap(supabase, overlapCache,  clientId, startISO, endISO);

      if (overlapAny) {
        const dayRef = DateTime.fromISO(dateStr, { zone: timezone }).set({ hour: 12 }).toJSDate();

        const suggestions = await findNextFreeSlots(
          supabase,
          overlapCache,
          clientId,
          null,
          dayRef,
          durationMin,
          timezone,
          5
        );

        const baseQuestion =
          "Zu dieser Zeit ist leider kein Slot frei. Welche andere Uhrzeit innerhalb der Öffnungszeiten passt Ihnen?";
        const question =
          suggestions.length > 0
            ? `${baseQuestion} Zum Beispiel: ${suggestions.join(", ")}.`
            : baseQuestion;

        if (conv) {
          await patchConversationState({
            supabase,
            id: conv.id,
            patch: { ...convState, lastIntent: intent, appointment: nextAppointment },
          });
        }

        return NextResponse.json(
          { status: "need_info", missing: "time", question, suggestions },
          { status: 200 }
        );
      }
    } else {
      if (requestedStaffName) {
        const { data: staffRow } = await supabase
          .from("staff")
          .select("id, name")
          .eq("client_id", clientId)
          .ilike("name", requestedStaffName)
          .maybeSingle();

        if (!staffRow) {
          return await needInfo("staff", "Welcher Mitarbeiter oder welche Mitarbeiterin soll es sein?");
        }

        staffId = staffRow.id;
        staffName = staffRow.name;

        const overlapRequested = await hasOverlap(supabase, overlapCache, clientId, startISO, endISO, staffId ?? undefined);

        if (overlapRequested) {
          const dayRef = DateTime.fromISO(dateStr, { zone: timezone }).set({ hour: 12 }).toJSDate();

          const suggestions = await findNextFreeSlots(
            supabase,
            overlapCache,
            clientId,
            staffId,
            dayRef,
            durationMin,
            timezone,
            5
          );

          const baseQuestion = `Zu dieser Zeit ist ${staffName} bereits ausgebucht.`;
          const question =
            suggestions.length > 0
              ? `${baseQuestion} Ich könnte Ihnen zum Beispiel ${suggestions.join(", ")} anbieten. Welche Uhrzeit passt Ihnen?`
              : `${baseQuestion} Haben Sie eine andere Uhrzeit im Kopf?`;

          if (conv) {
            await patchConversationState({
              supabase,
              id: conv.id,
              patch: { ...convState, lastIntent: intent, appointment: nextAppointment },
            });
          }

          return NextResponse.json(
            { status: "need_info", missing: "time", question, suggestions },
            { status: 200 }
          );
        }
      } else {
        if (svc.defaultStaffId) {
          const overlapDefault = await hasOverlap(
            supabase,
            overlapCache,
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

        if (!staffId) {
          const { data: staffList } = await supabase
            .from("staff")
            .select("id, name")
            .eq("client_id", clientId);

          if (Array.isArray(staffList) && staffList.length > 0) {
            let freeStaff: any = null;

            for (const s of staffList) {
              const ov = await hasOverlap(supabase, overlapCache, clientId, startISO, endISO, s.id);
              if (!ov) {
                freeStaff = s;
                break;
              }
            }

            if (freeStaff) {
              staffId = freeStaff.id;
              staffName = freeStaff.name;
            } else {
              const dayRef = DateTime.fromISO(dateStr, { zone: timezone }).set({ hour: 12 }).toJSDate();

              const suggestions = await findNextFreeSlots(
                supabase,
                overlapCache,
                clientId,
                null,
                dayRef,
                durationMin,
                timezone,
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
                  patch: { ...convState, lastIntent: intent, appointment: nextAppointment },
                });
              }

              return NextResponse.json(
                { status: "need_info", missing: "time", question, suggestions },
                { status: 200 }
              );
            }
          }
        }
      }

      if (!staffName && requestedStaffName) {
        staffName = requestedStaffName;
      }
    }

    // Draft speichern
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
        { status: "error", error: "draft_insert_failed", details: dErr },
        { status: 500 }
      );
    }

    // CSH aktualisieren (inkl. draftId)
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
        patch: { ...convState, lastIntent: intent, appointment: nextStateAfterDraft },
      });

      nextAppointment = nextStateAfterDraft;
    }

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

    const customerPart =
      customerName && customerName.trim().length > 0 ? ` für ${customerName.trim()}` : "";
    const staffPart = staffName && staffName.trim().length > 0 ? ` bei ${staffName.trim()}` : "";

    const preview = `„${svc.title}“ am ${dateStr} um ${timeStr}${customerPart}${staffPart}`;
    const phrase = `${staffNote} Ich habe ${preview} eingetragen. Soll ich den Termin fix eintragen?`;

    return NextResponse.json({ status: "confirm", draftId: draft.id, preview, phrase }, { status: 200 });
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
