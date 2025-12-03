// App Router – Twilio Call Webhook
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import * as crypto from "crypto";
import { twiml as TwiML } from "twilio";

const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN as string;
const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL;

function verifyTwilioSignature(req: NextRequest, body: Record<string, any>) {
  try {
    const sig = req.headers.get("x-twilio-signature") || "";
    const url = `${PUBLIC_BASE_URL}/api/call`;
    const payload = Object.keys(body)
      .sort()
      .reduce((acc, k) => acc + k + body[k], url);
    const expected = crypto
      .createHmac("sha1", TWILIO_AUTH_TOKEN)
      .update(Buffer.from(payload, "utf-8"))
      .digest("base64");
    return expected === sig;
  } catch {
    return false;
  }
}

export async function GET() {
  // Healthcheck
  return NextResponse.json({ ok: true, message: "AI Receptionist – /api/call alive" });
}

export async function POST(req: NextRequest) {
  // Twilio sendet x-www-form-urlencoded
  const form = await req.formData();
  const body: Record<string, any> = {};
  for (const [k, v] of form.entries()) body[k] = String(v);

  // In Prod signaturprüfen (lokal off)
  if (process.env.NODE_ENV === "production") {
    const valid = verifyTwilioSignature(req, body);
    if (!valid) {
      return NextResponse.json({ error: "Invalid Twilio signature" }, { status: 403 });
    }
  }

  const base = PUBLIC_BASE_URL;

const twiml = `
<Response>
  <Gather
    input="speech"
    language="de-DE"
    action="${base}/api/call/handle"
    method="POST"
    speechTimeout="auto"
    timeout="5"
    actionOnEmptyResult="true"
    hints="Termin, Terminbuchung, Uhrzeit, heute, morgen, Öffnungszeiten, Preise, Name, Telefonnummer">
    <Say language="de-DE" voice="alice">Willkommen. Was kann ich für Sie tun?</Say>
  </Gather>

  <Say language="de-DE" voice="alice">Ich habe nichts verstanden. Auf Wiederhören.</Say>
  <Hangup/>
</Response>`.trim();

return new Response(twiml, { headers: { "Content-Type": "text/xml" } });

}

