// app/api/ai/appointment/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClients } from "@/lib/supabaseClients";
import { appointmentPrompt } from "@/ai/prompts/appointment";
import { normalizeDate, normalizeTime, mapService, SERVICE_MAP } from "@/ai/logic/nlp";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function isISODate(s?: string | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function isTimeHM(s?: string | null): s is string {
  return !!s && /^\d{2}:\d{2}$/.test(s);
}

// Öffnungszeiten prüfen (business_hours Tabelle):
async function isWithinBusinessHours(
  supabase: any,
  clientId: string,
  start: Date,
  end: Date
): Promise<{ ok: boolean; reason?: string }> {
  const weekday = start.getUTCDay(); // 0=So ... 6=Sa
  const { data: hours } = await supabase
    .from("business_hours")
    .select("weekday, open_min, close_min, is_closed")
    .eq("client_id", clientId)
    .eq("weekday", weekday)
    .maybeSingle();

  if (!hours) return { ok: false, reason: "no_hours" };
  if (hours.is_closed) return { ok: false, reason: "closed" };

  const minutesSinceMidnight = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes();
  const sMin = minutesSinceMidnight(start);
  const eMin = minutesSinceMidnight(end);

  if (sMin < hours.open_min || eMin > hours.close_min) {
    return { ok: false, reason: "outside" };
  }
  return { ok: true };
}

// Überschneidung prüfen:
async function hasOverlap(
  supabase: any,
  clientId: string,
  startISO: string,
  endISO: string
): Promise<boolean> {
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
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id ?? process.env.DEV_USER_ID!;
    if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = await req.json().catch(() => null);
    const message: string | undefined = body?.message;
    if (!message) return NextResponse.json({ error: "bad_json" }, { status: 400 });

    // 1) LLM-Intent
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

    if (parsed?.intent !== "create_appointment") {
      return NextResponse.json({ status: "none" });
    }

    // 2) Fehlende Infos abfragen
    if (parsed.missing) {
      const q =
        parsed.missing === "date"
          ? "An welchem Tag möchtest du den Termin? (YYYY-MM-DD)"
          : parsed.missing === "time"
          ? "Welche Uhrzeit passt dir? (HH:MM, 24h)"
          : "Welche Leistung möchtest du genau? (z. B. Haarschnitt)";
      return NextResponse.json({ status: "need_info", missing: parsed.missing, question: q, draft: parsed });
    }

    // 3) Format-Check
    if (!isISODate(parsed.date)) {
      return NextResponse.json({
        status: "need_info",
        missing: "date",
        question: "Welches Datum genau? Bitte im Format YYYY-MM-DD.",
      });
    }
    if (!isTimeHM(parsed.time)) {
      return NextResponse.json({
        status: "need_info",
        missing: "time",
        question: "Welche Uhrzeit genau? Bitte im Format HH:MM (24h).",
      });
    }

    // 4) Service mappen/validieren
    const serviceKey = mapService(parsed.service || "");
    if (!serviceKey || !SERVICE_MAP[serviceKey]) {
      return NextResponse.json({
        status: "need_info",
        missing: "service",
        question: "Für welche Leistung möchtest du buchen? (z. B. Haarschnitt, Färben)",
      });
    }
    const durationMin = SERVICE_MAP[serviceKey].durationMin ?? 30;

    // 5) Client des Users holen (Onboarding sorgt dafür)
    const { data: clientRow } = await supabase
      .from("clients")
      .select("id")
      .eq("owner_user", userId)
      .single();

    const clientId = clientRow?.id;
    if (!clientId) {
      return NextResponse.json({
        status: "need_info",
        missing: "client",
        question: "Bitte Onboarding abschließen (Firmendaten/Öffnungszeiten/Services).",
      });
    }

    // 6) Start/Ende bestimmen
    const startLocal = `${parsed.date}T${parsed.time}:00`;
    const startAt = new Date(startLocal);          // lokale Eingabe
    const endAt = new Date(startAt.getTime() + durationMin * 60 * 1000);
    const startISO = startAt.toISOString();
    const endISO = endAt.toISOString();

    // 7) Öffnungszeiten-Check
    const hoursOk = await isWithinBusinessHours(supabase, clientId, startAt, endAt);
    if (!hoursOk.ok) {
      const msg =
        hoursOk.reason === "closed"
          ? "An dem Tag ist geschlossen. Hast du einen anderen Tag im Kopf?"
          : "Die Uhrzeit liegt außerhalb der Öffnungszeiten. Welche Zeit innerhalb der Öffnungszeiten passt dir?";
      return NextResponse.json({ status: "need_info", missing: "time", question: msg });
    }

    // 8) Overlap-Check
    if (await hasOverlap(supabase, clientId, startISO, endISO)) {
      return NextResponse.json({
        status: "need_info",
        missing: "time",
        question: "Dieser Slot ist belegt. 30 Min früher oder später okay?",
      });
    }

    // 9) Draft speichern
    const { data: draft, error: dErr } = await supabase
      .from("appointment_drafts")
      .insert({
        user_id: userId,
        client_id: clientId,
        title: SERVICE_MAP[serviceKey].label,
        start_at: startISO,
        end_at: endISO,
        service: serviceKey,
        source: "ai",
      })
      .select()
      .single();

    if (dErr) return NextResponse.json({ error: "draft_insert_failed", details: dErr.message }, { status: 500 });

    // 10) Freundliche Bestätigungsfrage
    const preview = `${SERVICE_MAP[serviceKey].label}; ${parsed.date} ${parsed.time}`;
    return NextResponse.json({
      status: "confirm",
      draftId: draft.id,
      preview,
      phrase:
        `Ich habe „${SERVICE_MAP[serviceKey].label}“ für ${parsed.date} um ${parsed.time} eingetragen. ` +
        `Soll ich den Termin fix eintragen?`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: "appointment_parse_failed", details: e?.message }, { status: 500 });
  }
}
