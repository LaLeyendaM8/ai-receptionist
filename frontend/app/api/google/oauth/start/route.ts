

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { cookies } from "next/headers";

import { getBaseUrl } from "@/lib/getBaseUrl";
import { createClients } from "@/lib/supabaseClients";
import { getCurrentUserId } from "@/lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "gcal_oauth_state";

type OAuthState = {
  userId: string;
  nonce: string;
  returnTo?: string;
};

function encodeState(state: OAuthState) {
  return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}

function safeReturnTo(path: string | null) {
  if (!path) return null;
  if (!path.startsWith("/")) return null;
  if (path.startsWith("//")) return null;

  // MVP-whitelist
  const allowed = new Set(["/onboarding", "/dashboard/settings"]);
  if (allowed.has(path)) return path;

  return null;
}

function randomNonce() {
  // nodejs runtime => crypto ist da
  return crypto.randomUUID();
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  // ✅ 1) returnTo kommt vom UI (Onboarding oder Settings)
  const requestedReturnTo = url.searchParams.get("returnTo");
  const returnTo = safeReturnTo(requestedReturnTo) ?? "/onboarding";

  // ✅ must be logged in
  const supabase = await createClients();
  const userId = await getCurrentUserId(supabase);
  if (!userId) return NextResponse.redirect(new URL("/login", req.url));

  const base = getBaseUrl(req);
  const redirectUri = `${base}/api/google/oauth/callback`;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "missing_google_env" }, { status: 500 });
  }

  const nonce = randomNonce();

  // ✅ 2) state enthält returnTo
  const stateStr = encodeState({ userId, nonce, returnTo });

  // nonce in cookie, callback prüft es
  const cookieStore = await cookies();
  cookieStore.set({
    name: STATE_COOKIE,
    value: nonce,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/google/oauth",
    maxAge: 60 * 10, // 10 min
  });

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/calendar",
      // falls du nur read brauchst später: calendar.readonly
    ],
    state: stateStr,
  });

  return NextResponse.redirect(authUrl);
}
