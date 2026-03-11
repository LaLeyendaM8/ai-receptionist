import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { faqPrompt } from "@/ai/prompts/faq";
import { buildFaqContext } from "@/ai/logic/faqContext";
import {
  ensureConversationState,
  patchConversationState,
  type HandoffCS,
} from "@/lib/callflow/conversation-state";
import { notifyHandoff } from "@/lib/notify/notifyHandoff";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

type FaqLLMResponse = {
  intent?: string; // "faq" | "handoff" | "route_appointment" ...
  answer?: string;
  confidence?: number; // 0..1
};

export type FaqFlowInput = {
  supabase: SupabaseClient;
  message: string;

  clientId?: string | null;
  userId?: string | null;
  sessionId?: string | null;
  fromNumber?: string | null;

  forceHandoff?: boolean;
};

export type FaqFlowResult =
  | { status: "answer"; answer: string; confidence: number }
  | { status: "route_appointment"; message: string }
  | { status: "handoff"; message: string }
  | { status: "handoff_open"; handoffId: string; message: string }
  | { status: "transfer_requested"; message: string }
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

function normalizeText(s: string) {
  return (s || "").trim().toLowerCase();
}

function looksLikeTransferChoice(s: string) {
  const t = normalizeText(s);
  return [
    "verbinden",
    "weiterleiten",
    "mitarbeiter",
    "jemand",
    "echte person",
    "mensch",
    "direkt sprechen",
  ].some((x) => t.includes(x));
}

function looksLikeMessageChoice(s: string) {
  const t = normalizeText(s);
  return [
    "nachricht",
    "meldung",
    "hinterlassen",
    "rückruf",
    "zurückrufen",
    "benachrichtigen",
  ].some((x) => t.includes(x));
}

function looksAffirmative(s: string) {
  const t = normalizeText(s);
  return [
    "ja",
    "ja bitte",
    "genau",
    "stimmt",
    "passt",
    "richtig",
    "gerne",
    "okay",
    "ok",
  ].includes(t);
}

function extractPhone(input: string): string | null {
  const raw = (input || "").trim();
  if (!raw) return null;

  const hasPlus = raw.includes("+");
  const digits = raw.replace(/\D/g, "");

  if (digits.length < 7) return null;

  return hasPlus ? `+${digits}` : digits;
}

function cleanName(input: string): string | null {
  const value = (input || "").trim();
  if (!value) return null;
  if (value.length < 2) return null;
  return value;
}

async function resetHandoffState(
  supabase: SupabaseClient,
  convId: string
): Promise<void> {
  await patchConversationState({
    supabase,
    id: convId,
    patch: {
      handoff: {
        mode: null,
        source: null,
        choice: null,
        stage: null,
        question: null,
        customerName: null,
        customerPhone: null,
      },
    },
  });
}

async function createAndNotifyHandoff(args: {
  supabase: SupabaseClient;
  clientId: string;
  userId?: string | null;
  notificationEmail?: string | null;
  question: string;
  customerName?: string | null;
  customerPhone?: string | null;
  intent: string;
  confidence: number;
  source: string;
}) {
  const {
    supabase,
    clientId,
    userId,
    notificationEmail,
    question,
    customerName,
    customerPhone,
    intent,
    confidence,
    source,
  } = args;

  const { data: inserted, error: insErr } = await supabase
    .from("handoffs")
    .insert({
      client_id: clientId,
      user_id: userId ?? null,
      question,
      customer_name: customerName ?? null,
      customer_phone: customerPhone ?? null,
      intent,
      confidence,
      status: "open",
      source,
    })
    .select()
    .single();

  if (insErr || !inserted) {
    console.error("[FAQ] handoff_insert_failed:", insErr);
    return {
      ok: false as const,
      error: insErr?.message ?? "handoff_insert_failed",
    };
  }

  try {
    if (notificationEmail) {
      await notifyHandoff({
        to: notificationEmail,
        question,
        customerName: customerName ?? null,
        customerPhone: customerPhone ?? null,
      });
    }
  } catch (mailErr) {
    console.error("[FAQ] notifyHandoff failed:", mailErr);
  }

  return {
    ok: true as const,
    handoffId: inserted.id as string,
  };
}

export async function runFaqFlow(input: FaqFlowInput): Promise<FaqFlowResult> {
  try {
    const {
      supabase,
      message,
      clientId: clientIdFromBody,
      userId,
      sessionId,
      fromNumber,
      forceHandoff = false,
    } = input;

    const { clientId, text: context } = await buildFaqContext({
      userId: userId ?? null,
      clientId: clientIdFromBody ?? undefined,
    });

    if (!clientId) {
      return {
        status: "handoff",
        message:
          "Ich habe gerade nicht alle Firmendaten parat. Ich leite die Anfrage an einen Mitarbeiter weiter.",
      };
    }

    const { data: clientRow, error: clientErr } = await supabase
      .from("clients")
      .select("ai_enabled, notification_email")
      .eq("id", clientId)
      .maybeSingle();

    if (clientErr) {
      console.error("[FAQ] client load failed", clientErr);
      return {
        status: "error",
        error: "client_load_failed",
        details: clientErr.message,
      };
    }

    if (!clientRow?.ai_enabled) {
      return {
        status: "handoff",
        message: "Einen Moment, ich leite Sie an einen Mitarbeiter weiter.",
      };
    }

    let conv: any = null;
    let handoffState: HandoffCS = {};

    if (sessionId) {
      try {
        conv = await ensureConversationState({
          supabase,
          clientId,
          sessionId,
          channel: "phone",
        });

        handoffState = ((conv.state as any)?.handoff ?? {}) as HandoffCS;
      } catch (err) {
        console.warn("[FAQ] ensureConversationState failed", err);
      }
    }

    // ------------------------------------------------------------
    // Aktiver Handoff-Dialog
    // ------------------------------------------------------------
    if (handoffState?.stage) {
      const stage = handoffState.stage;

      if (stage === "awaiting_choice") {
        if (looksLikeTransferChoice(message)) {
          if (conv?.id) {
            await resetHandoffState(supabase, conv.id);
          }

          return {
            status: "transfer_requested",
            message:
              "Alles klar. Ich versuche, Sie jetzt mit einem Mitarbeiter zu verbinden.",
          };
        }

        if (looksLikeMessageChoice(message)) {
          if (conv?.id) {
            await patchConversationState({
              supabase,
              id: conv.id,
              patch: {
                handoff: {
                  ...handoffState,
                  choice: "message",
                  stage: "awaiting_message",
                  customerPhone: handoffState.customerPhone ?? fromNumber ?? null,
                },
              },
            });
          }

          return {
            status: "handoff",
            message:
              "Gerne. Worum geht es genau? Ich notiere Ihre Nachricht für das Unternehmen.",
          };
        }

        return {
          status: "handoff",
          message:
            "Möchten Sie direkt mit einem Mitarbeiter sprechen oder soll ich eine Nachricht hinterlassen?",
        };
      }

      if (stage === "awaiting_message") {
        const nextQuestion = message.trim();

        if (!nextQuestion) {
          return {
            status: "handoff",
            message:
              "Was möchten Sie dem Unternehmen genau mitteilen?",
          };
        }

        if (conv?.id) {
          await patchConversationState({
            supabase,
            id: conv.id,
            patch: {
              handoff: {
                ...handoffState,
                question: nextQuestion,
                stage: "awaiting_name",
              },
            },
          });
        }

        return {
          status: "handoff",
          message: "Wie ist Ihr Name?",
        };
      }

      if (stage === "awaiting_name") {
        const customerName = cleanName(message);

        if (!customerName) {
          return {
            status: "handoff",
            message:
              "Wie ist Ihr Name, damit das Unternehmen Sie korrekt zuordnen kann?",
          };
        }

        const knownPhone = handoffState.customerPhone ?? fromNumber ?? null;

        if (conv?.id) {
          await patchConversationState({
            supabase,
            id: conv.id,
            patch: {
              handoff: {
                ...handoffState,
                customerName,
                customerPhone: knownPhone,
                stage: knownPhone ? "awaiting_phone_confirm" : "awaiting_phone",
              },
            },
          });
        }

        if (knownPhone) {
          return {
            status: "handoff",
            message: `Soll das Unternehmen Sie unter der Nummer ${knownPhone} zurückrufen? Sagen Sie bitte ja oder nennen Sie eine andere Telefonnummer.`,
          };
        }

        return {
          status: "handoff",
          message: "Unter welcher Telefonnummer kann man Sie zurückrufen?",
        };
      }

      if (stage === "awaiting_phone_confirm") {
        if (looksAffirmative(message)) {
          const result = await createAndNotifyHandoff({
            supabase,
            clientId,
            userId,
            notificationEmail: clientRow?.notification_email ?? null,
            question: handoffState.question ?? "Rückrufbitte",
            customerName: handoffState.customerName ?? null,
            customerPhone: handoffState.customerPhone ?? fromNumber ?? null,
            intent: "handoff",
            confidence: 1,
            source: handoffState.source ?? "human_handoff",
          });

          if (!result.ok) {
            return {
              status: "error",
              error: "handoff_insert_failed",
              details: result.error,
            };
          }

          if (conv?.id) {
            await resetHandoffState(supabase, conv.id);
          }

          return {
            status: "handoff_open",
            handoffId: result.handoffId,
            message:
              "Alles klar. Ich habe Ihre Nachricht aufgenommen und gebe sie an das Unternehmen weiter. Es meldet sich so schnell wie möglich bei Ihnen.",
          };
        }

        const newPhone = extractPhone(message);

        if (!newPhone) {
          return {
            status: "handoff",
            message:
              "Bitte nennen Sie mir kurz die Telefonnummer, unter der man Sie erreichen kann.",
          };
        }

        const result = await createAndNotifyHandoff({
          supabase,
          clientId,
          userId,
          notificationEmail: clientRow?.notification_email ?? null,
          question: handoffState.question ?? "Rückrufbitte",
          customerName: handoffState.customerName ?? null,
          customerPhone: newPhone,
          intent: "handoff",
          confidence: 1,
          source: handoffState.source ?? "human_handoff",
        });

        if (!result.ok) {
          return {
            status: "error",
            error: "handoff_insert_failed",
            details: result.error,
          };
        }

        if (conv?.id) {
          await resetHandoffState(supabase, conv.id);
        }

        return {
          status: "handoff_open",
          handoffId: result.handoffId,
          message:
            "Alles klar. Ich habe Ihre Nachricht aufgenommen und gebe sie an das Unternehmen weiter. Es meldet sich so schnell wie möglich bei Ihnen.",
        };
      }

      if (stage === "awaiting_phone") {
        const customerPhone = extractPhone(message);

        if (!customerPhone) {
          return {
            status: "handoff",
            message:
              "Bitte nennen Sie mir kurz die Telefonnummer, unter der man Sie erreichen kann.",
          };
        }

        const result = await createAndNotifyHandoff({
          supabase,
          clientId,
          userId,
          notificationEmail: clientRow?.notification_email ?? null,
          question: handoffState.question ?? "Rückrufbitte",
          customerName: handoffState.customerName ?? null,
          customerPhone,
          intent: "handoff",
          confidence: 1,
          source: handoffState.source ?? "human_handoff",
        });

        if (!result.ok) {
          return {
            status: "error",
            error: "handoff_insert_failed",
            details: result.error,
          };
        }

        if (conv?.id) {
          await resetHandoffState(supabase, conv.id);
        }

        return {
          status: "handoff_open",
          handoffId: result.handoffId,
          message:
            "Alles klar. Ich habe Ihre Nachricht aufgenommen und gebe sie an das Unternehmen weiter. Es meldet sich so schnell wie möglich bei Ihnen.",
        };
      }
    }

    // ------------------------------------------------------------
    // Explizit Eskalation starten
    // ------------------------------------------------------------
    if (forceHandoff) {
      if (conv?.id) {
        await patchConversationState({
          supabase,
          id: conv.id,
          patch: {
            handoff: {
              mode: "escalation",
              source: "human_handoff",
              choice: null,
              stage: "awaiting_choice",
              question: null,
              customerName: null,
              customerPhone: fromNumber ?? null,
            },
          },
        });
      }

      return {
        status: "handoff",
        message:
          "Gerne. Möchten Sie direkt mit einem Mitarbeiter sprechen oder soll ich eine Nachricht hinterlassen, damit sich das Unternehmen bei Ihnen meldet?",
      };
    }

    // ------------------------------------------------------------
    // Normaler FAQ-LLM-Flow
    // ------------------------------------------------------------
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

    if (intent === "route_appointment") {
      return {
        status: "route_appointment",
        message: "Gern – ich helfe Ihnen bei der Terminbuchung.",
      };
    }

    const shouldHandoff = intent === "handoff" || conf < 0.6;

    if (shouldHandoff) {
      if (conv?.id) {
        await patchConversationState({
          supabase,
          id: conv.id,
          patch: {
            handoff: {
              mode: "escalation",
              source: "faq",
              choice: null,
              stage: "awaiting_choice",
              question: null,
              customerName: null,
              customerPhone: fromNumber ?? null,
            },
          },
        });
      }

      return {
        status: "handoff",
        message:
          "Ich bin mir gerade nicht ganz sicher. Möchten Sie direkt mit einem Mitarbeiter sprechen oder soll ich eine Nachricht hinterlassen, damit sich das Unternehmen bei Ihnen meldet?",
      };
    }

    return {
      status: "answer",
      answer: parsed.answer || "Gern, kann ich sonst noch etwas für Sie tun?",
      confidence: conf,
    };
  } catch (e: any) {
    console.error("[CALLFLOW faq] failed:", e);
    return {
      status: "error",
      error: "faq_failed",
      details: e?.message ?? String(e),
    };
  }
}