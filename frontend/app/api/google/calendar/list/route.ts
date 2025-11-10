// app/api/calendar/list/route.ts
import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClients } from '@/lib/supabaseClients'

export async function GET() {
  const supabase = createClients()
  const uid = process.env.DEV_USER_ID!
  const { data: tok, error } = await supabase.from('google_tokens').select('*').eq('user_id', uid).single()
  if (error || !tok) return NextResponse.json({ error: 'no_tokens' }, { status: 400 })

  const oauth2 = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID!, process.env.GOOGLE_CLIENT_SECRET!)
  oauth2.setCredentials(tok)
  const calendar = google.calendar({ version: 'v3', auth: oauth2 })
  const { data } = await calendar.events.list({ calendarId: 'primary', maxResults: 10, singleEvents: true, orderBy: 'startTime' })
  return NextResponse.json({ events: data.items ?? [] })
}
