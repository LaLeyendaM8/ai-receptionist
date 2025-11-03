// backend/api/call/recording.ts
// Receives POST from Twilio after <Record>. For now, it just logs the URL and acknowledges.


import type { NextApiRequest, NextApiResponse } from 'next'


export async function recordingHandler(req: NextApiRequest, res: NextApiResponse) {
if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })


const { RecordingUrl, RecordingSid, From, CallSid } = req.body || {}


console.log('[Twilio Recording]', { RecordingUrl, RecordingSid, From, CallSid })


// TODO: Download audio and forward to /api/whisper/transcribe for STT
// e.g., POST { url: `${RecordingUrl}.mp3`, callSid: CallSid }


return res.status(200).json({ ok: true })
}


export default recordingHandler