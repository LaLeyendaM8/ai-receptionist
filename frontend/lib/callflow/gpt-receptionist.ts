import type { SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export type SmartFallbackInput = {
  supabase: SupabaseClient;
  text: string;
  clientId?: string | null;
  fromNumber?: string | null;
  toNumber?: string | null;
  sessionId?: string | null;
};

export type SmartFallbackResult = {
  success: true;
  intent: "fallback";
  confidence: number;
  end_call: boolean;
  reply: string;
  answer?: string;
  brain?: {
    raw?: unknown;
    meta?: Record<string, unknown>;
  };
};

type ClientLite = {
  id: string;
  business_name?: string | null;
  ai_profile?: string | null;
};

async function loadClientLite(
  supabase: SupabaseClient,
  clientId?: string | null
): Promise<ClientLite | null> {
  if (!clientId) return null;

  const { data, error } = await supabase
    .from("clients")
    .select("id, name, ai_profile")
    .eq("id", clientId)
    .maybeSingle();

  if (error) {
    console.error("[SMART_FALLBACK] client load error", error);
    return null;
  }

  return (data as ClientLite | null) ?? null;
}

function buildSystemPrompt(args: {
  businessName?: string | null;
  aiProfile?: string | null;
}) {
  const { businessName, aiProfile } = args;

  return `
Du bist der Fallback-Sprachassistent für einen telefonischen KI-Empfang.

Wichtige Regeln:
- Du bist NICHT für die eigentliche Terminlogik zuständig.
- Du bist NICHT für deterministische FAQ zuständig.
- Du bist NICHT für Handoff-Dialoge zuständig.
- Diese Dinge werden bereits vom System separat behandelt.

Deine Aufgabe:
- Beantworte nur freie, unklare oder gemischte Nutzeräußerungen kurz und natürlich.
- Antworte knapp, freundlich und telefonisch natürlich.
- Keine langen Erklärungen.
- Keine Halluzinationen.
- Wenn dir eine Information fehlt, sage das offen und leite freundlich auf eine kurze Frage, Terminbuchung oder Mitarbeiterwunsch zurück.
- Versprich nichts, was nicht im Kontext steht.
- Sprich auf Deutsch.

Kontext Unternehmen:
- Name: ${businessName ?? "Unbekannt"}
- AI-Profil: ${aiProfile ?? "nicht hinterlegt"}

Antworte als JSON im Format:
{
  "reply": "kurze telefonische Antwort",
  "should_end_call": false
}
`.trim();
}

function safeFallbackReply() {
  return "Entschuldigung, dabei kann ich Ihnen gerade nicht ganz sicher helfen. Geht es um einen Termin, eine kurze Frage oder möchten Sie mit einem Mitarbeiter sprechen?";
}

function extractJsonObject(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export async function runGptReceptionistFlow(
  input: SmartFallbackInput
): Promise<SmartFallbackResult> {
  const { supabase, text, clientId } = input;

  const client = await loadClientLite(supabase, clientId);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: buildSystemPrompt({
            businessName: client?.business_name ?? null,
            aiProfile: client?.ai_profile ?? null,
          }),
        },
        {
          role: "user",
          content: text,
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content ?? "";
    const parsed = extractJsonObject(content) as
      | { reply?: string; should_end_call?: boolean }
      | null;

    const reply =
      typeof parsed?.reply === "string" && parsed.reply.trim()
        ? parsed.reply.trim()
        : safeFallbackReply();

    return {
      success: true,
      intent: "fallback",
      confidence: 0.55,
      end_call: Boolean(parsed?.should_end_call),
      reply,
      answer: reply,
      brain: {
        raw: parsed ?? content,
        meta: {
          model: "gpt-4.1-mini",
        },
      },
    };
  } catch (error) {
    console.error("[SMART_FALLBACK] error", error);

    const reply = safeFallbackReply();

    return {
      success: true,
      intent: "fallback",
      confidence: 0.2,
      end_call: false,
      reply,
      answer: reply,
      brain: {
        raw: null,
        meta: {
          error: error instanceof Error ? error.message : String(error),
        },
      },
    };
  }
}