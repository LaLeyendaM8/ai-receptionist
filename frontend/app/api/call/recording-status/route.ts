export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse, type NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  console.log('[Twilio Recording Status]', Object.fromEntries(form.entries()));
  return NextResponse.json({ ok: true });
}
