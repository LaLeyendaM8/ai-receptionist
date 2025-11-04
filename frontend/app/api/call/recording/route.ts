export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse, type NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const RecordingUrl = String(form.get('RecordingUrl') ?? '');
  const RecordingSid = String(form.get('RecordingSid') ?? '');
  const From = String(form.get('From') ?? '');
  const CallSid = String(form.get('CallSid') ?? '');

  console.log('[Twilio Recording]', { RecordingUrl, RecordingSid, From, CallSid });
  // TODO: Hier später Download + Whisper-Transkription triggern
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, where: 'recording' });
}
