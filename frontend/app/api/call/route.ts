// backend/api/call/index.ts
import crypto from 'crypto'
import { twiml as TwiML } from 'twilio'
import type { NextApiRequest, NextApiResponse } from 'next'


// --- Env ---
// Required: TWILIO_AUTH_TOKEN
// Optional: PUBLIC_BASE_URL (e.g., https://your-domain.com)
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN as string
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:3000'


// --- Verify Twilio Signature (recommended) ---
function verifyTwilioSignature(req: NextApiRequest): boolean {
try {
const signature = (req.headers['x-twilio-signature'] || '') as string
const url = `${PUBLIC_BASE_URL}/api/call` // must match Twilio webhook URL exactly


// Build expected signature using Twilio's algorithm
const params = req.method === 'POST' && typeof req.body === 'object' ? req.body : {}
const data = Object.keys(params)
.sort()
.reduce((acc, key) => acc + key + params[key], url)


const expected = crypto
.createHmac('sha1', TWILIO_AUTH_TOKEN)
.update(Buffer.from(data, 'utf-8'))
.digest('base64')


return expected === signature
} catch (e) {
return false
}
}


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
if (req.method === 'GET') {
return res.status(200).json({ ok: true, message: 'AI Receptionist – /api/call alive' })
}


if (req.method !== 'POST') {
return res.status(405).json({ error: 'Method not allowed' })
}


// Optional: enable to enforce verification in production
if (process.env.NODE_ENV === 'production') {
const valid = verifyTwilioSignature(req)
if (!valid) return res.status(403).json({ error: 'Invalid Twilio signature' })
}


const vr = new TwiML.VoiceResponse()


// Greeting
vr.say({ voice: 'alice', language: 'de-DE' }, 'Hallo! Ich bin die digitale Rezeptionistin. Bitte sagen Sie kurz Ihr Anliegen nach dem Signalton.')


// Record up to 30s, then POST the recording to our handler
vr.record({
maxLength: 30,
playBeep: true,
trim: 'do-not-trim',
action: `${PUBLIC_BASE_URL}/api/call/recording`,
method: 'POST',
recordingStatusCallback: `${PUBLIC_BASE_URL}/api/call/recording-status`,
recordingStatusCallbackMethod: 'POST',
})


// Fallback if no input
vr.say({ voice: 'alice', language: 'de-DE' }, 'Ich habe nichts gehört. Wir verbinden Sie bei Bedarf später zurück. Auf Wiederhören.')
vr.hangup()


res.setHeader('Content-Type', 'text/xml')
return res.status(200).send(vr.toString())
}