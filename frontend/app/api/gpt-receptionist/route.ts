// app/api/gpt-receptionist/route.ts
import { getBaseUrl } from "@/lib/getBaseUrl";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createServiceClient } from "@/lib/supabaseClients";
import { ensureConversationState, incrementCounter } from "@/lib/conversation-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });


export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/gpt-receptionist" });
}

export async function POST(req: Request) {
  const base = getBaseUrl(req);
  try {
     const { text, fromNumber, toNumber, clientId, sessionId } = (await req.json()) as {
    text?: string;
    fromNumber?: string | null;
    toNumber?: string | null;
    clientId?: string | null;
    sessionId?: string | null;
  };

  if (!text || typeof text !== "string") {
    return NextResponse.json(
      { success: false, error: "missing text" },
      { status: 400 }
    );
  }

  // 1) Profil laden (MVP: client-spezifisch, Fallback: neuestes ai_profile)
      let profileText = "";
    let client: { id: string; ai_profile?: string | null } | null = null;

    try {
      const supabase = createServiceClient();

      if (clientId) {
        // Multi-Tenant: direkt über clientId
        const { data, error: clientErr } = await supabase
          .from("clients")
          .select("id, ai_profile")
          .eq("id", clientId)
          .maybeSingle();

        if (clientErr) {
          console.error("[BRAIN] profile load error (by clientId)", clientErr);
        }
        client = data;
      } else {
        // Fallback: wie bisher → neuestes Profil des aktuellen Users
        const { data, error: profileErr } = await supabase
          .from("clients")
          .select("id, ai_profile")
          .not("ai_profile", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (profileErr) {
          console.error("[BRAIN] profile load error (no clientId)", profileErr);
        }
        client = data;
      }

      if (client?.ai_profile) {
        profileText = client.ai_profile as string;
      }
    } catch (e) {
      console.error("[BRAIN] profile load unexpected", e);
    }


    // 2) System-Prompt inkl. Profil
const system = `
Du bist eine freundliche Telefon-Rezeptionistin.

${profileText ? `UNTERNEHMENSPROFIL (nur intern, nicht vorlesen):
${profileText}
` : ""}

WICHTIG: Du gibst IMMER NUR ein gültiges JSON zurück (ohne Markdown, ohne Text außenrum).

Schema (genau so):
{
  "intent": "create_appointment" | "cancel_appointment" | "reschedule_appointment" | "appointment_info" | "availability" | "staff_availability" | "appointment_confirm" | "faq" | "other",
  "reply": string | null,
  "confidence": number,
  "end_call": boolean
}

Regeln:
- Wenn der Nutzer eine Frage zu Öffnungszeiten/Preisen/Adresse/Services/sonstigen Infos stellt → intent="faq" und reply=null.
- Wenn der Nutzer einen Termin buchen/ändern/stornieren will → passende Appointment-Intents, reply=null.
- Wenn der Nutzer eindeutig bestätigt ("ja", "bitte buchen", "bestätige", "mach das") und es klingt nach Termin bestätigen → intent="appointment_confirm", reply=null.
- Wenn du nicht sicher bist → intent="other", reply="freundliche Rückfrage", confidence niedrig.
- confidence zwischen 0 und 1.
- Wenn der Nutzer nach abgeschlossenem intent klar sagt "das war´s", "tschüss", "danke", etc, -> end_call: true + reply = kurze Verabschiedung
- Wenn intent other und confidence niedrig -> Rückfrage + end_call: false
`;


const resp = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  temperature: 0.2,
  messages: [
    { role: "system", content: system },
    {
      role: "user",
      content: `Nutzer sagt am Telefon: """${text}"""`,
    },
  ],
});


const content = resp.choices[0]?.message?.content ?? "{}";

let brain: any;
try {
  brain = JSON.parse(content);
} catch {
  const match = content.match(/\{[\s\S]*\}$/m);
  try {
    brain = match ? JSON.parse(match[0]) : null;
  } catch {
    brain = null;
  }
}

if (!brain || typeof brain !== "object") {
  brain = {
    intent: "other",
    reply: "Entschuldigung, ich habe das nicht ganz verstanden. Können Sie das bitte nochmal kurz sagen?",
    confidence: 0.2,
  };
}

const intent = String(brain.intent || "other").toLowerCase();
const confidence = Math.max(0, Math.min(1, Number(brain.confidence ?? 0.5)));


// Wenn "bye"/"tschüss"/ etc. -> end_call true (Hard-rule)
const t = text.trim().toLowerCase();
const hardEnd =
  ["tschüss", "ciao", "auf wiederhören", "danke das war alles", "ne, das war's", "das wars"].some(x => t.includes(x)) && t.length <= 40;

if (hardEnd) {
  return NextResponse.json({
    success: true,
    intent: "other",
    reply: "Alles klar. Vielen Dank für Ihren Anruf. Auf Wiederhören.",
    end_call: true,
    confidence: 0.9,
  });
}

// Wenn LLM unsicher ist → immer Rückfrage
if (intent === "other" && confidence < 0.35) {
  // CSH counter erhöhen
  if ((client?.id ?? clientId) && sessionId) {
    try {
      const supabase = createServiceClient();
      const conv = await ensureConversationState({
        supabase,
        clientId: (client?.id ?? clientId) as string,
        sessionId,
        channel: "phone",
      });

      const count = await incrementCounter({ supabase, conv, key: "noUnderstandCount" });

      if (count >= 3) {
        return NextResponse.json({
          success: true,
          intent: "other",
          reply: "Entschuldigung – ich verstehe Sie gerade leider nicht. Am besten verbinden wir Sie mit einem Mitarbeiter. Auf Wiederhören.",
          end_call: true,
          confidence,
        });
      }
    } catch (e) {
      console.warn("[BRAIN] increment noUnderstandCount failed", e);
    }
  }

  return NextResponse.json({
    success: true,
    intent,
    reply: brain.reply || "Entschuldigung, ich habe das nicht ganz verstanden. Können Sie das bitte nochmal kurz sagen?",
    end_call: false,
    confidence,
  });
}

const endCallFromBrain = Boolean(brain.end_call);

let result: any = { intent, meta: brain.meta || {}, end_call: endCallFromBrain };

// 1) Termin-Kram → Appointment-Superlogik
const appointmentIntents = new Set([
  // neue Varianten aus appointmentPrompt
  "create_appointment",
  "cancel_appointment",
  "reschedule_appointment",
  "appointment_info",
  "availability",
  "staff_availability",
  "appointment_confirm",

  // alte Fallbacks, falls der Brain-Prompt noch an einer Stelle
  // "appointment" / "appointment_booking" / "route_appointment" ausspuckt
  "appointment",
  "appointment_booking",
  "route_appointment",
]);

if (appointmentIntents.has(intent)) {
  const r = await fetch(`${base}/api/ai/appointment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: text,
      clientId: client?.id ?? clientId ?? null,
      sessionId,       // kommt vom Call-Handle
      intent,          // Brain-Intent z.B. "create_appointment" oder "appointment_confirm"
      parsed: brain.meta?.parsed ?? null, // optional, falls du später was brauchst
    }),
  });

  if (!r.ok) {
    console.warn("[BRAIN] appointment status:", r.status);
    result.reply =
      brain.reply ||
      "Es ist ein Fehler bei der Terminverarbeitung aufgetreten. Bitte versuchen Sie es später erneut.";
  } else {
    const data = await r.json();
    result = { ...result, ...data };
    // default


// end_call nur überschreiben, wenn appointment route es wirklich setzt
if (typeof (data as any)?.end_call === "boolean") {
  result.end_call = (data as any).end_call;
}
// sonst: Brain end_call behalten (result.end_call ist ja schon endCallFromBrain)


// Call beenden wenn der Nutzer "fertig" ist -> kommt später durch LLM
// Hier nur: wenn ein Flow wirklich abgeschlossen ist, kann man end_call optional true setzen
if (data.status === "confirmed" || data.status === "cancelled" || data.status === "rescheduled") {
  // NICHT automatisch true, sonst kann User nichts mehr fragen.
  // Wir lassen Brain entscheiden. ABER: Wir können hier eine "completion"-Marke setzen:
  result.completed = true;
}

    if (data.status === "need_info" && data.question) {
      result.reply = data.question;
    } else if (data.message) {
      result.reply = data.message;
    } else if (data.reply) {
      result.reply = data.reply;
    }
  }
}

    // 2) FAQ → /api/ai/faq
else if (intent === "faq") {
  const r = await fetch(`${base}/api/ai/faq`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: text,
      clientId: client?.id ?? clientId ?? null,
      // sessionId optional, falls du später FAQ-CSE willst:
      sessionId: sessionId ?? null,
    }),
  });

  if (!r.ok) {
    console.warn("[BRAIN] faq status:", r.status);
    result.reply =
      "Leider kann ich Ihre Frage gerade nicht beantworten. Bitte versuchen Sie es später erneut.";
  } else {
    const data = await r.json();
    result = { ...result, ...data };
    
if (typeof (data as any)?.end_call === "boolean") {
  result.end_call = (data as any).end_call;
}

    // Wenn FAQ sagt "route_appointment" -> direkt in Appointment flow übergeben
    if (data.status === "route_appointment") {
      const ar = await fetch(`${base}/api/ai/appointment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          clientId: client?.id ?? clientId ?? null,
          sessionId,
          intent: "create_appointment", // oder "route_appointment" -> appointment handled das bei dir als alias
          parsed: null,
        }),
      });

      if (ar.ok) {
        const ad = await ar.json();
        result = { ...result, ...ad };
        result.intent = "create_appointment";
        result.reply = ad.question ?? ad.message ?? ad.reply ?? "Gern – für wann möchten Sie den Termin?";
      } else {
        result.reply = "Gern – ich kann den Termin anlegen. Für wann soll er sein?";
      }
    } else {
      // normale FAQ-Antwort / Handoff
      result.reply = data.answer ?? data.message ?? "Okay.";
    }
  }
}

    // 3) Alles andere → direkt GPT-Reply (Smalltalk, etc.)
else {
  result.reply =
    brain.reply ||
    "Entschuldigung, ich habe das nicht ganz verstanden. Können Sie das bitte nochmal kurz sagen?";
  result.confidence = confidence;
}

if (!result.reply || typeof result.reply !== "string") {
  result.reply = "Alles klar. Wie kann ich Ihnen helfen?";
}



    return NextResponse.json({ success: true, ...result, end_call: Boolean(result.end_call) });

  } catch (err: any) {
    console.error("GPT Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
