import { NextResponse } from 'next/server'
import { createClients } from '@/lib/supabaseClients'

export async function GET() {
  const supabase = createClients()
  const { data, error } = await supabase
    .from('calls')
    .select('*, clients(name, phone)')
    .order('started_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

export async function POST(req: Request) {
  const supabase = createClients()
  const body = await req.json()
  // erlaubt: { client_id?, direction?, from_number?, to_number?, language?, outcome?, booking_id?, transcript?, meta? }
  const payload = {
    direction: 'inbound',
    language: 'de',
    status: undefined, // nicht vorhanden in deiner calls Tabelle
    meta: {},
    ...body,
  }

  const { data, error } = await supabase.from('calls').insert(payload).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data }, { status: 201 })
}
