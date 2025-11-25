import { NextResponse } from 'next/server'
import { createClients } from '@/lib/supabaseClients'

// GET: alle Termine (neueste zuerst)
export async function GET() {
  const supabase = await createClients ();
  const { data, error } = await supabase
    .from('appointments')
    .select('*, clients:clients!appointments_client_id_fkey(name, phone)') 
    //            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^  <- DEINE FK hier einsetzen
    .order('start_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message, details: error }, { status: 400 })
  return NextResponse.json({ data })
}


// POST: Termin anlegen
export async function POST(req: Request) {
  const supabase = await createClients();

  let body: any
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  // Pflichtfelder deiner Tabelle: client_id, start_at
  if (!body.client_id) {
    return NextResponse.json({ error: 'client_id is required' }, { status: 400 })
  }
  if (!body.start_at) {
    return NextResponse.json({ error: 'start_at is required' }, { status: 400 })
  }

  // Whitelist exakt deiner Spalten
  const payload = {
    client_id: body.client_id,
    title: body.title ?? 'Termin',
    customer_name: body.customer_name ?? null,
    customer_phone: body.customer_phone ?? null,
    start_at: body.start_at,            // ISO-String oder timestamptz
    end_at: body.end_at ?? null,        // optional
    source: body.source ?? 'ai',
    status: body.status ?? 'booked',    // deine Defaults
    notes: body.notes ?? null
  }

  const { data, error } = await supabase
    .from('appointments')
    .insert(payload)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message, details: error }, { status: 400 })
  }
  return NextResponse.json({ data }, { status: 201 })
}
