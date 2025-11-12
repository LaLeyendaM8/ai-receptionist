import OpenAI from "openai";
import { appointmentPrompt } from "@/ai/prompts/appointment";
import { createClients } from "@/lib/supabaseClients";
import { getOAuth2ForUser } from "@/lib/googleServer";
import { google } from "googleapis";
import { normalizeDate, normalizeTime, mapService, SERVICE_MAP } from "@/ai/logic/nlp";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
function isISODate(s?: string | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function isTimeHM(s?: string | null): s is string {
  return !!s && /^\d{2}:\d{2}$/.test(s);
}

async function ensureClientForUser(supabase: any, userId: string): Promise<string> {
  // 1) existierenden Client (Owner = userId) holen
  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .eq("owner_user", userId)
    .limit(1)
    .single();

  if (existing?.id) return existing.id as string;

  // 2) falls keiner existiert: Dummy-Client anlegen
  const { data: created, error: cErr } = await supabase
    .from("clients")
    .insert({
      name: "Testkunde",
      phone: "",
      email: "",
      address: {},
      timezone: "Europe/Berlin",
      active: true,
      owner_user: userId, // wichtig für spätere Zuordnung
    })
    .select("id")
    .single();

  if (cErr) throw cErr;
  return created!.id as string;
}

type FlowResult =
  | { status: "none" }
  | { status: "need_info"; missing: "date" | "time" | "service"; question: string; draft?: any }
  | { status: "created"; appointment: any; googleEventId?: string };

export async function handleAppointmentMessage(message: string, userId: string): Promise<FlowResult> {
  // 1) Intent erkennen
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
    return { status: "none" };
  }
  if (parsed?.intent !== "create_appointment") return { status: "none" };

  // 2) VALIDIERUNG & NORMALISIERUNG (HIER!)
  // fehlende Infos abfragen (falls das LLM sie schon gemeldet hat)
  if (parsed.missing) {
    const question =
      parsed.missing === "date"
        ? "An welchem Tag möchtest du den Termin?"
        : parsed.missing === "time"
        ? "Welche Uhrzeit passt dir?"
        : "Welche Leistung möchtest du genau (z. B. Haarschnitt)?";
    return { status: "need_info", missing: parsed.missing, question, draft: parsed };
  }

  // ggf. aus der natürlichen Sprache im message-Text ergänzen
  const mapped = parsed.service ? mapService(parsed.service) : mapService(message);
  const serviceTitle  = mapped?.title ?? parsed.service ?? null;
  const durationMin   = mapped?.durationMin ?? 30;

  let dateISO = isISODate(parsed.date) ? parsed.date : normalizeDate(message);
  let timeHM  = isTimeHM(parsed.time)   ? parsed.time : normalizeTime(message);

  if (!serviceTitle) {
    return { status: "need_info", missing: "service", question: "Welche Leistung (z. B. Haarschnitt, Farbe)?" };
  }
  if (!dateISO) {
    return { status: "need_info", missing: "date", question: "Welches Datum genau? (z. B. 2025-11-12 oder „Freitag/morgen“)" };
  }
  if (!timeHM) {
    return { status: "need_info", missing: "time", question: "Welche Uhrzeit genau? (HH:MM, 24h)" };
  }

  // einfache Öffnungszeiten-Validierung (optional)
  const [hh, mm] = timeHM.split(":").map(Number);
  if (hh < 9 || hh > 18 || (hh === 18 && mm > 0)) {
    return {
      status: "need_info",
      missing: "time",
      question: "Wir haben 09:00–18:00 geöffnet. Welche Uhrzeit in diesem Zeitraum passt dir?"
    };
  }

  // 3) DB: Client sichern und Termin anlegen
  const supabase = createClients(); // <- dein Wrapper

  const clientId = await ensureClientForUser(supabase, userId);

  const startLocal = `${dateISO}T${timeHM}:00`;
  const startAtISO = new Date(startLocal).toISOString();
  const endAtISO   = new Date(new Date(startLocal).getTime() + durationMin * 60000).toISOString();

  // (optional) Konflikt-Check
  const { data: overlaps } = await supabase
    .from("appointments")
    .select("id,start_at,end_at")
    .or(`and(start_at.lte.${endAtISO},end_at.gte.${startAtISO})`)
    .limit(1);
  if (overlaps?.length) {
    return { status: "need_info", missing: "time", question: "Der Slot ist belegt. Passt dir 30 Min früher oder später?" };
  }

  const { data: appts, error } = await supabase
    .from("appointments")
    .insert({
      client_id: clientId,
      title: serviceTitle,
      start_at: startAtISO,
      end_at: endAtISO,
      status: "booked",
      source: "ai",
    })
    .select()
    .limit(1);
  if (error) throw error;

  const appointment = appts![0];

  // 4) Google-Event erstellen + zurückschreiben
  const { oauth2 } = await getOAuth2ForUser(userId);
  const calendar = google.calendar({ version: "v3", auth: oauth2 });
  const ins = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: appointment.title,
      description: "Erstellt durch AI-Rezeptionist",
      start: { dateTime: appointment.start_at, timeZone: "Europe/Berlin" },
      end:   { dateTime: appointment.end_at,   timeZone: "Europe/Berlin" },
    },
  });
  if (ins.data.id) {
    await supabase.from("appointments").update({ google_event_id: ins.data.id }).eq("id", appointment.id);
  }

  return { status: "created", appointment, googleEventId: ins.data.id ?? undefined };
}

