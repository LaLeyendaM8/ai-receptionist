import { NextResponse } from "next/server";
import twilio from "twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const { AccessToken } = twilio.jwt;
const { VoiceGrant } = AccessToken;

export async function GET() {
  const accSid = process.env.TWILIO_ACCOUNT_SID!;
  const apiSid = process.env.TWILIO_API_KEY_SID!;
  const apiSecret = process.env.TWILIO_API_KEY_SECRET!;
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID!;

  if (!accSid || !apiSid || !apiSecret || !twimlAppSid) {
    return NextResponse.json(
      { error: "Missing Twilio env vars" },
      { status: 500 }
    );
  }

  // beliebige Identität für den Browser-Client
  const identity = `web-${Math.random().toString(36).slice(2, 8)}`;

  const token = new AccessToken(accSid, apiSid, apiSecret, { identity });
  const grant = new VoiceGrant({
    outgoingApplicationSid: twimlAppSid, // -> ruft /api/call (TwiML App) auf
    // incomingAllow: true, // nur nötig, wenn du eingehende Client-Calls willst
  });
  token.addGrant(grant);

  return NextResponse.json({ token: token.toJwt(), identity });
}
