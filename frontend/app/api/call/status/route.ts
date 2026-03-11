export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { validateRequest } from "twilio";
import { getBaseUrl } from "@/lib/getBaseUrl";
import { createServiceClient } from "@/lib/supabaseClients";
import { reportCallUsage } from "@/lib/stripe/stripeUsage";

const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN as string;

function verifyTwilioSignature(req: NextRequest, params: Record<string, string>) {
  const signature = req.headers.get("x-twilio-signature") ?? "";
  if (!signature) return false;

  const base = getBaseUrl(req);
  const url = `${base}${req.nextUrl.pathname}${req.nextUrl.search}`;

  return validateRequest(TWILIO_AUTH_TOKEN, signature, url, params);
}

async function parseForm(req: NextRequest): Promise<Record<string, string>> {
  const form = await req.formData();
  const body: Record<string, string> = {};

  for (const [k, v] of form.entries()) {
    body[k] = String(v);
  }

  return body;
}

async function loadClientByTwilioNumber(
  supabase: ReturnType<typeof createServiceClient>,
  calledNumber: string
) {
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, twilio_number")
    .eq("twilio_number", calledNumber)
    .maybeSingle();

  if (error) {
    console.error("[CALL STATUS] loadClientByTwilioNumber error:", error);
    return null;
  }

  return data;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "AI Receptionist – /api/call/status alive",
  });
}

export async function POST(req: NextRequest) {
  try {
    if (process.env.NODE_ENV === "production") {
      if (!TWILIO_AUTH_TOKEN) {
        console.error("[CALL STATUS] TWILIO_AUTH_TOKEN missing in production");
        return new Response("Server misconfigured", { status: 500 });
      }
    }

    const params = await parseForm(req);

    if (process.env.NODE_ENV === "production") {
      const valid = verifyTwilioSignature(req, params);
      if (!valid) {
        return NextResponse.json(
          { error: "Invalid Twilio signature" },
          { status: 403 }
        );
      }
    }

    const callSid = params.CallSid || "";
    const callStatus = (params.CallStatus || "").toLowerCase();
    const calledNumber = params.To || params.Called || params.ToFormatted || "";
    const durationSeconds = Number(params.CallDuration || 0);

    // Nur abgeschlossene Calls reporten
    if (callStatus !== "completed") {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "call_not_completed",
      });
    }

    // Ohne CallSid kein sicheres Idempotency-Handling
    if (!callSid) {
      console.warn("[CALL STATUS] missing CallSid");
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "missing_call_sid",
      });
    }

    // 0-Sekunden-Calls nicht abrechnen
    if (!durationSeconds || durationSeconds <= 0) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "no_billable_duration",
      });
    }

    if (!calledNumber) {
      console.warn("[CALL STATUS] missing called number");
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "missing_called_number",
      });
    }

    const supabase = createServiceClient();

    const client = await loadClientByTwilioNumber(supabase, calledNumber);

    if (!client?.id) {
      console.warn("[CALL STATUS] no client found for called number", calledNumber);
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "client_not_found",
      });
    }

    const startedAt =
      params.Timestamp || null; // optional; Twilio liefert hier nicht immer ideal verwertbare ISO-Zeit
    const endedAt = new Date().toISOString();

    const result = await reportCallUsage({
      clientId: client.id,
      twilioCallSid: callSid,
      durationSeconds,
      callStartedAt: startedAt,
      callEndedAt: endedAt,
    });

    return NextResponse.json({
      ok: true,
      reported: true,
      result,
    });
  } catch (error: any) {
    console.error("[CALL STATUS] fatal:", error);
    return NextResponse.json(
      {
        error: "call_status_failed",
        details: error?.message ?? "unknown_error",
      },
      { status: 500 }
    );
  }
}