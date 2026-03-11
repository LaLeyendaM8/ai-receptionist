// lib/ttsToken.ts
import crypto from "crypto";

const SECRET = process.env.TTS_TOKEN_SECRET as string;
if (!SECRET) throw new Error("TTS_TOKEN_SECRET missing");

/**
 * base64url helpers (Node >= 18 supports base64url)
 */
function b64urlEncode(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function b64urlDecode(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

/**
 * Creates a short-lived signed token for TTS usage (Twilio <Play> compatible)
 * token format: <payloadB64>.<exp>.<sig>
 */
export function createTtsToken(payload: string, ttlSeconds = 120) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;

  const payloadB64 = b64urlEncode(payload);
  const data = `${payloadB64}.${exp}`;

  const sig = crypto.createHmac("sha256", SECRET).update(data).digest("hex");
  return `${payloadB64}.${exp}.${sig}`;
}

/**
 * Verifies token integrity + expiration
 * Returns payload (decoded text) or null
 */
export function verifyTtsToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [payloadB64, expStr, sig] = parts;
  const exp = Number(expStr);

  if (!exp || Date.now() / 1000 > exp) return null;

  const expectedSig = crypto
    .createHmac("sha256", SECRET)
    .update(`${payloadB64}.${exp}`)
    .digest("hex");

  try {
    if (
      !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
    ) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    return b64urlDecode(payloadB64);
  } catch {
    return null;
  }
}
