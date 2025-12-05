// app/api/gpt-receptionist/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createServiceClient } from "@/lib/supabaseClients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const BASE =
  process.env.PUBLIC_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL;

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/gpt-receptionist" });
}

export async function POST(req: Request) {
  try {
     const { text, clientId } = (await req.json()) as {
    text?: string;
    clientId?: string | null;
  };

  if (!text || typeof text !== "string") {
    return NextResponse.json(
      { success: false, error: "missing text" },
      { status: 400 }
    );
  }

  // 1) Profil laden (MVP: client-spezifisch, Fallback: neuestes ai_profile)
  let profileText = "";
  try {
    const supabase = createServiceClient();

    // 1a) Wenn clientId übergeben wurde → genau dieses Unternehmen laden
    if (clientId) {
      const { data, error } = await supabase
        .from("clients")
        .select("ai_profile")
        .eq("id", clientId)
        .maybeSingle();

      if (!error && data?.ai_profile) {
        profileText = data.ai_profile as string;
      } else if (error) {
        console.error("[BRAIN] profile load (by clientId) error", error);
      }
    }

    // 1b) Fallback: wie bisher, neuestes Profil mit ai_profile ≠ null
    if (!profileText) {
      const { data, error } = await supabase
        .from("clients")
        .select("ai_profile")
        .not("ai_profile", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data?.ai_profile) {
        profileText = data.ai_profile as string;
      } else if (error) {
        console.error("[BRAIN] profile load (fallback) error", error);
      }
    }
  } catch (e) {
    console.error("[BRAIN] profile load unexpected", e);
  }


    // 2) System-Prompt inkl. Profil
    const system = `
Du bist eine freundliche Rezeptionistin.

${
  profileText
    ? `UNTERNEHMENSPROFIL (nur intern für dich, nicht vorlesen):
${profileText}

`
    : ""
}Antworten:
- Sprich die Anrufer:innen höflich und natürlich auf Deutsch an.
- Halte dich an Öffnungszeiten, Dienstleistungen, Preise und FAQs aus dem Profil.
- Wenn du etwas nicht sicher weißt, sag ehrlich, dass du es nicht weißt.
- Gib nur Informationen, die zu diesem Unternehmen passen.
`;

    // 3) OpenAI-Call wie bisher
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content:
            'Gib nur ein gültiges json-objekt zurück, ohne Markdown/Erklärung.\n' +
            `Nutzeranfrage: """${text}"""`,
        },
      ],
    });

    const content = resp.choices[0]?.message?.content ?? "{}";
    // Robust parsen
    let brain: any;
    try {
      brain = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}$/m);
      brain = match
        ? JSON.parse(match[0])
        : {
            intent: "other",
            reply: content,
            meta: { language: "de", confidence: 0.5 },
          };
    }

    // --- Brain-Routing ---
    const intent = (brain.intent || "").toLowerCase();
    let result: any = { intent, meta: brain.meta || {} };

    // 1) Termin-Kram → Appointment-Superlogik
    if (
      intent === "appointment" ||
      intent === "appointment_booking" ||
      intent === "route_appointment"
    ) {
      const r = await fetch(`${BASE}/api/ai/appointment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!r.ok) {
        console.warn("[BRAIN] appointment status:", r.status);
        result.reply =
          brain.reply ||
          "Es gab ein Problem bei der Terminverwaltung. Bitte versuchen Sie es später erneut.";
      } else {
        const data = await r.json();
        result = { ...result, ...data };

        // etwas zum Vorlesen für /api/call/handle vorbereiten
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
      const r = await fetch(`${BASE}/api/ai/faq`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!r.ok) {
        console.warn("[BRAIN] faq status:", r.status);
        result.reply =
          brain.reply ||
          "Leider kann ich Ihre Frage gerade nicht beantworten. Bitte versuchen Sie es später erneut.";
      } else {
        const data = await r.json();
        result = { ...result, ...data };
        result.reply = data.answer ?? data.reply ?? brain.reply;
      }
    }
    // 3) Alles andere → direkt GPT-Reply (Smalltalk, etc.)
    else {
      result.reply =
        brain.reply ||
        "Alles klar, ich habe das so notiert. Gibt es sonst noch etwas, womit ich helfen kann?";
    }

    return NextResponse.json({ success: true, ...result });

  } catch (err: any) {
    console.error("GPT Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
