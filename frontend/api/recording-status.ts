// backend/api/call/recording-status.ts
// Optional status callback for recording life-cycle events.


import type { NextApiRequest, NextApiResponse } from 'next'


export async function statusHandler(req: NextApiRequest, res: NextApiResponse) {
if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
console.log('[Twilio Recording Status]', req.body)
return res.status(200).json({ ok: true })
}


export default statusHandler