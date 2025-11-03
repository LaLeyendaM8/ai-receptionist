// backend/api/call/test-call.ts
// Local endpoint to preview the exact TwiML without using Twilio.


import type { NextApiRequest, NextApiResponse } from 'next'
import { twiml as TwiML2 } from 'twilio'


export async function testHandler(_req: NextApiRequest, res: NextApiResponse) {
const vr = new TwiML2.VoiceResponse()
vr.say({ voice: 'alice', language: 'de-DE' }, 'Dies ist ein Test der Twilio-TwiML Ausgabe.')
res.setHeader('Content-Type', 'text/xml')
return res.status(200).send(vr.toString())
}


export default testHandler