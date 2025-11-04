// App Router – Twilio Call Webhook
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse, type NextRequest } from 'next/server';
import * as crypto from 'crypto';
import { twiml as TwiML } from 'twilio';

const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN as string;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';

function verifyTwilioSignature(req: NextRequest, body: Record<string, any>) {
  try {
    const sig = req.headers.get('x-twilio-signature') || '';
    const url = `${PUBLIC_BASE_URL}/api/call`;
    const data = Object.keys(body).sort().reduce((acc, k) => acc + k + body[k], url);
    const expected = crypto.createHmac('sha1', TWILIO_AUTH_TOKEN)
      .update(Buffer.from(data, 'utf-8'))
      .digest('base64');
    return expected === sig;
  } catch {
    return false;
  }
}

export async function GET() {
  // Healthcheck
  return NextResponse.json({ ok: true, message: 'AI Receptionist – /api/call alive' });
}

export async function POST(req: NextRequest) {
  // Twilio sendet x-www-form-urlencoded → im App Router mit formData() lesen
  const form = await req.formData();
  const body: Record<string, any> = {};
  for (const [k, v] of form.entries()) body[k] = String(v);

  if (process.env.NODE_ENV === 'production') {
    const valid = verifyTwilioSignature(req, body);
    if (!valid) return NextResponse.json({ error: 'Invalid Twilio signature' }, { status: 403 });
  }

  const vr = new TwiML.VoiceResponse();
  vr.say({ voice: 'alice', language: 'de-DE' },
    'Hallo! Ich bin die digitale Rezeptionistin. Bitte sagen Sie kurz Ihr Anliegen nach dem Signalton.');
  vr.record({
    maxLength: 30,
    playBeep: true,
    trim: 'do-not-trim',
    action: `${PUBLIC_BASE_URL}/api/call/recording`,
    method: 'POST',
    recordingStatusCallback: `${PUBLIC_BASE_URL}/api/call/recording-status`,
    recordingStatusCallbackMethod: 'POST',
  });
  vr.say({ voice: 'alice', language: 'de-DE' }, 'Ich habe nichts gehört. Auf Wiederhören.');
  vr.hangup();

  return new Response(vr.toString(), { headers: { 'Content-Type': 'text/xml' } });
}
