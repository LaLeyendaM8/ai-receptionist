// app/api/ai/appointment/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClients } from "@/lib/supabaseClients";
import { appointmentPrompt } from "@/ai/prompts/appointment";
import { isWithinBusinessHours } from "@/ai/logic/hours";
import { getServiceByMessage } from "@/ai/logic/services";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function isISODate(s?: string | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function isTimeHM(s?: string | null): s is string {
  return !!s && /^\d{2}:\d{2}$/.test(s);
}

// Überschneidungen gegen bestehende Termine prüfen
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
    // Supabase-Client (dein Wrapper)
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
    if (parsed?.intent !== "create_appointment") {
      return NextResponse.json({ status: "none" });
    }

    // 2) Fehlende Infos abfragen
    if (parsed.missing) {
      const q =
        parsed.missing === "date"
          ? "An welchem Tag möchten sie den Termin? (YYYY-MM-DD)"
          : parsed.missing === "time"
          ? "Welche Uhrzeit passt ihnen? (HH:MM, 24h)"
          : "Welche Leistung möchten sie genau? (z. B. Haarschnitt)";
      return NextResponse.json({
        status: "need_info",
        missing: parsed.missing,
        question: q,
        draft: parsed,
      });
    }

    // 3) Format-Checks
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

    // 4) Mandant (Client) des Users holen
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
        question:
          "Bitte Onboarding abschließen (Firmendaten/Öffnungszeiten/Services).",
      });
    }

    // 5) Service aus DB mappen (statt statischem SERVICE_MAP)
    const svc = await getServiceByMessage(clientId, parsed.service || message);
    if (!svc?.title || !svc?.durationMin) {
      return NextResponse.json({
        status: "need_info",
        missing: "service",
        question:
          "Für welche Leistung möchten sie buchen? (z. B. Haarschnitt, Färben)",
      });
    }

    // 6) Zeiten berechnen
    const startLocal = `${parsed.date}T${parsed.time}:00`;
    const startAt = new Date(startLocal);
    const endAt = new Date(startAt.getTime() + svc.durationMin * 60 * 1000);
    const startISO = startAt.toISOString();
    const endISO = endAt.toISOString();

    // 7) Öffnungszeiten-Check (Helper aus ai/logic/hours)
    const within = await isWithinBusinessHours(clientId, parsed.date, parsed.time);
    if (!within) {
      return NextResponse.json({
        status: "need_info",
        missing: "time",
        question:
          "Die Uhrzeit liegt außerhalb der Öffnungszeiten. Welche Zeit innerhalb der Öffnungszeiten passt ihnen?",
      });
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
        title: svc.title,
        start_at: startISO,
        end_at: endISO,
        service: svc.title,
        source: "ai",
      })
      .select()
      .single();

    if (dErr) {
      return NextResponse.json(
        { error: "draft_insert_failed", details: dErr.message },
        { status: 500 }
      );
    }

    // 10) Freundliche Bestätigungsfrage
    const preview = `${svc.title}; ${parsed.date} ${parsed.time}`;
    return NextResponse.json({
      status: "confirm",
      draftId: draft.id,
      preview,
      phrase: `Ich habe „${svc.title}“ für ${parsed.date} um ${parsed.time} eingetragen. Soll ich den Termin fix eintragen?`,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "appointment_parse_failed", details: e?.message },
      { status: 500 }
    );
  }
}
