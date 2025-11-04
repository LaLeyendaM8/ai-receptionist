export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { twiml as TwiML } from 'twilio';

export async function GET() {
  const vr = new TwiML.VoiceResponse();
  vr.say({ voice: 'alice', language: 'de-DE' }, 'Dies ist ein Test der TwiML-Ausgabe.');
  return new Response(vr.toString(), { headers: { 'Content-Type': 'text/xml' } });
}
