export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClients } from "@/lib/supabaseClients";
import { faqPrompt } from "@/ai/prompts/faq";
import { buildFaqContext } from "@/ai/logic/faqContext";
import { notifyHandoff } from "@/lib/notifyHandoff";
import { getCurrentUserId } from "@/lib/authServer";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

type FaqLLMResponse = {
  intent?: string; // "faq" | "handoff" | "route_appointment" ...
  answer?: string;
  confidence?: number; // 0..1
};

export async function POST(req: Request) {
  const supabase = await createClients();

  try {
    // 1) Body lesen
    const body = await req.json().catch(() => null);
    const userQuestion: string | undefined = body?.message;
    const clientIdFromBody: string | null = body?.clientId ?? null;

    if (!userQuestion) {
      return NextResponse.json({ error: "bad_json" }, { status: 400 });
    }

    // 2) Tenant bestimmen: entweder direkt per clientId (Call)
    //    oder über eingeloggt User → owner_user (Dashboard)
    let userId: string | null = null;

    if (!clientIdFromBody) {
      userId = await getCurrentUserId(supabase);
      if (!userId) {
        return NextResponse.json(
          { error: "unauthenticated" },
          { status: 401 }
        );
      }
    }

    // 3) Kontext aus DB bauen
    const { clientId, text: context } = await buildFaqContext({
      userId,
      clientId: clientIdFromBody ?? undefined,
    });

    // Kein Client hinterlegt → sofort Handoff
    if (!clientId) {
      return NextResponse.json(
        {
          status: "handoff",
          message:
            "Mir fehlen Firmendaten (z.B. Öffnungszeiten). Ich leite die Anfrage an einen Mitarbeiter weiter.",
        },
        { status: 200 }
      );
    }

    // 3b) AI für diesen Client aktiviert?
    const { data: clientRow } = await supabase
      .from("clients")
      .select("ai_enabled, notification_email")
      .eq("id", clientId)
      .maybeSingle();

    if (!clientRow?.ai_enabled) {
      return NextResponse.json(
        {
          status: "handoff",
          message:
            "Die AI ist aktuell deaktiviert. Ich leite an einen Mitarbeiter weiter.",
        },
        { status: 200 }
      );
    }

    // 4) LLM-Aufruf
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: faqPrompt },
        { role: "user", content: `KONTEXT:\n${context}` },
        {
          role: "user",
          content:
            `FRAGE:\n${userQuestion}\n\n` +
            `Antworte STRIKT als JSON-Objekt mit den Feldern "intent", "answer" und "confidence".`,
        },
      ],
    });

    let parsed: FaqLLMResponse = {};
    try {
      parsed = JSON.parse(completion.choices[0].message?.content || "{}");
    } catch (err) {
      console.error("FAQ JSON parse error:", err);
    }

    const intent = parsed.intent ?? "faq";
    const conf = Math.max(0, Math.min(1, parsed.confidence ?? 0.5));

    // 5) Explizit zum Termin-Flow routen
    if (intent === "route_appointment") {
      return NextResponse.json(
        {
          status: "route_appointment",
          message: "Gern – ich kann den Termin für Sie anlegen.",
        },
        { status: 200 }
      );
    }

    // 6) Entscheiden, ob wir sicher genug sind oder an Mensch abgeben
    const shouldHandoff = intent === "handoff" || conf < 0.6;

    if (shouldHandoff) {
      // 6a) Handoff-Row anlegen
      const { data: inserted, error: insErr } = await supabase
        .from("handoffs")
        .insert({
          client_id: clientId,
          user_id: userId, // kann bei Call null sein, falls Spalte nullable ist
          question: userQuestion,
          intent,
          confidence: conf,
          status: "open",
          source: "faq",
        })
        .select()
        .single();

      if (insErr) {
        console.error("handoff_insert_failed:", insErr);
        return NextResponse.json(
          { error: "handoff_insert_failed", details: insErr.message },
          { status: 500 }
        );
      }

      // 6b) E-Mail-Benachrichtigung (best effort)
      try {
        if (clientRow?.notification_email) {
          await notifyHandoff(clientRow.notification_email, userQuestion);
        }
      } catch (mailErr) {
        console.error("notifyHandoff failed:", mailErr);
      }

      return NextResponse.json(
        {
          status: "handoff_open",
          handoffId: inserted.id,
          message:
            "Ich habe Ihre Anfrage an unser Team weitergeleitet. Wir melden uns kurzfristig.",
        },
        { status: 200 }
      );
    }

    // 7) Normale FAQ-Antwort zurückgeben
    return NextResponse.json(
      {
        status: "answer",
        answer: parsed.answer || "Ich hoffe, das hilft Ihnen weiter.",
        confidence: conf,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("faq_failed:", e);
    return NextResponse.json(
      { error: "faq_failed", details: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
