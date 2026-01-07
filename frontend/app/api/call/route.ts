// App Router – Twilio Call Webhook
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getBaseUrl } from "@/lib/getBaseUrl";
import { NextResponse, type NextRequest } from "next/server";
import { validateRequest } from "twilio";


const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN as string;

function verifyTwilioSignature(req: NextRequest, params: Record<string, string>) {
  const signature = req.headers.get("x-twilio-signature") ?? "";
  if (!signature) return false;

  const base = getBaseUrl(req);

  // Twilio signiert mit der exakten URL inkl. Querystring
  const url = `${base}${req.nextUrl.pathname}${req.nextUrl.search}`;

  return validateRequest(
    TWILIO_AUTH_TOKEN,
    signature,
    url,
    params
  );
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
  const base = getBaseUrl(req);
  
  // In Prod signaturprüfen (lokal off)
  if (process.env.NODE_ENV === "production") {
    const valid = verifyTwilioSignature(req, body);
    if (!valid) {
      return NextResponse.json({ error: "Invalid Twilio signature" }, { status: 403 });
    }
  }



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

