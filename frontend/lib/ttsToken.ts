// lib/ttsToken.ts
import crypto from "crypto";

const SECRET = process.env.TTS_TOKEN_SECRET as string;

if (!SECRET) {
  throw new Error("TTS_TOKEN_SECRET missing");
}

/**
 * Creates a short-lived signed token for TTS usage (Twilio <Play> compatible)
 * payload = usually the spoken text (already clamped)
 */
export function createTtsToken(payload: string, ttlSeconds = 120) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const data = `${payload}.${exp}`;

  const sig = crypto
    .createHmac("sha256", SECRET)
    .update(data)
    .digest("hex");

  return `${payload}.${exp}.${sig}`;
}

/**
 * Verifies token integrity + expiration
 * Returns payload (text) or null
 */
export function verifyTtsToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [payload, expStr, sig] = parts;
  const exp = Number(expStr);

  if (!exp || Date.now() / 1000 > exp) return null;

  const expectedSig = crypto
    .createHmac("sha256", SECRET)
    .update(`${payload}.${exp}`)
    .digest("hex");

  try {
    if (
      !crypto.timingSafeEqual(
        Buffer.from(sig),
        Buffer.from(expectedSig)
      )
    ) {
      return null;
    }
  } catch {
    return null;
  }

  return payload;
}
