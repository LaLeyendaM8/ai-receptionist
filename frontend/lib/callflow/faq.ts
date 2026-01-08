// lib/callflow/faq.ts
import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { faqPrompt } from "@/ai/prompts/faq";
import { buildFaqContext } from "@/ai/logic/faqContext";
import { notifyHandoff } from "@/lib/notifyHandoff";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

type FaqLLMResponse = {
  intent?: string; // "faq" | "handoff" | "route_appointment" ...
  answer?: string;
  confidence?: number; // 0..1
};

export type FaqFlowInput = {
  supabase: SupabaseClient;

  message: string;

  // tenant context
  clientId?: string | null;
  userId?: string | null;

  // ✅ neu: optional (für später / consistency, behebt TS error)
  sessionId?: string | null;
};

export type FaqFlowResult =
  | { status: "answer"; answer: string; confidence: number }
  | { status: "route_appointment"; message: string }
  | { status: "handoff"; message: string }
  | { status: "handoff_open"; handoffId: string; message: string }
  | { status: "error"; error: string; details?: string };

function clamp01(n: any, fallback = 0.5) {
  const x = Number.isFinite(Number(n)) ? Number(n) : fallback;
  return Math.max(0, Math.min(1, x));
}

function safeJsonParse(s: string): any | null {
  try {
    return JSON.parse(s);
  } catch {
    const match = s.match(/\{[\s\S]*\}$/m);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export async function runFaqFlow(input: FaqFlowInput): Promise<FaqFlowResult> {
  try {
    const { supabase, message, clientId: clientIdFromBody, userId } = input;

    // 1) Kontext aus DB bauen
    const { clientId, text: context } = await buildFaqContext({
      userId: userId ?? null,
      clientId: clientIdFromBody ?? undefined,
    });

    // Kein Client → Handoff
    if (!clientId) {
      return {
        status: "handoff",
        message:
          "Mir fehlen Firmendaten (z.B. Öffnungszeiten). Ich leite die Anfrage an einen Mitarbeiter weiter.",
      };
    }

    // 2) AI aktiviert + notification_email holen
    const { data: clientRow, error: clientErr } = await supabase
      .from("clients")
      .select("ai_enabled, notification_email")
      .eq("id", clientId)
      .maybeSingle();

    if (clientErr) {
      console.error("[FAQ] client load failed", clientErr);
      return { status: "error", error: "client_load_failed", details: clientErr.message };
    }

    if (!clientRow?.ai_enabled) {
      return {
        status: "handoff",
        message: "Die AI ist aktuell deaktiviert. Ich leite an einen Mitarbeiter weiter.",
      };
    }

    // 3) LLM
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: faqPrompt },
        { role: "user", content: `KONTEXT:\n${context}` },
        {
          role: "user",
          content:
            `FRAGE:\n${message}\n\n` +
            `Antworte STRIKT als JSON-Objekt mit den Feldern "intent", "answer" und "confidence".`,
        },
      ],
    });

    const content = completion.choices[0].message?.content ?? "{}";
    const parsed = (safeJsonParse(content) ?? {}) as FaqLLMResponse;

    const intent = String(parsed.intent ?? "faq").toLowerCase();
    const conf = clamp01(parsed.confidence, 0.5);

    // 4) Explizit zum Termin-Flow routen
    if (intent === "route_appointment") {
      return {
        status: "route_appointment",
        message: "Gern – ich kann den Termin für Sie anlegen.",
      };
    }

    // 5) Handoff Entscheidung
    const shouldHandoff = intent === "handoff" || conf < 0.6;

    if (shouldHandoff) {
      const { data: inserted, error: insErr } = await supabase
        .from("handoffs")
        .insert({
          client_id: clientId,
          user_id: userId ?? null,
          question: message,
          intent,
          confidence: conf,
          status: "open",
          source: "faq",
        })
        .select()
        .single();

      if (insErr || !inserted) {
        console.error("[FAQ] handoff_insert_failed:", insErr);
        return {
          status: "error",
          error: "handoff_insert_failed",
          details: insErr?.message ?? "unknown",
        };
      }

      // Email (best effort)
      try {
        if (clientRow?.notification_email) {
          await notifyHandoff(clientRow.notification_email, message);
        }
      } catch (mailErr) {
        console.error("[FAQ] notifyHandoff failed:", mailErr);
      }

      return {
        status: "handoff_open",
        handoffId: inserted.id,
        message:
          "Ich habe Ihre Anfrage an unser Team weitergeleitet. Wir melden uns kurzfristig.",
      };
    }

    // 6) Normale Antwort
    return {
      status: "answer",
      answer: parsed.answer || "Ich hoffe, das hilft Ihnen weiter.",
      confidence: conf,
    };
  } catch (e: any) {
    console.error("[CALLFLOW faq] failed:", e);
    return { status: "error", error: "faq_failed", details: e?.message ?? String(e) };
  }
}
