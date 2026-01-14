import { NextResponse } from "next/server";
import { google } from "googleapis";
import crypto from "crypto";
import { cookies } from "next/headers";

import { getBaseUrl } from "@/lib/getBaseUrl";
import { createClients } from "@/lib/supabaseClients";
import { getCurrentUserId } from "@/lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "gcal_oauth_state";

function encodeState(obj: unknown) {
  const raw = JSON.stringify(obj);
  return Buffer.from(raw, "utf8").toString("base64url");
}

export async function GET(req: Request) {
  // ✅ auth user (must be logged in)
  const supabase = await createClients();
  const currentUserId = await getCurrentUserId(supabase);
  if (!currentUserId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const base = getBaseUrl(req);
  const redirectUri = `${base}/api/google/oauth/callback`;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "missing_google_env" }, { status: 500 });
  }

  // ✅ CSRF protection: nonce in state + same nonce stored in HttpOnly cookie
  const nonce = crypto.randomUUID();
  const state = encodeState({ userId: currentUserId, nonce });

  const cookieStore = await cookies();
  cookieStore.set({
    name: STATE_COOKIE,
    value: nonce,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/google/oauth",
    maxAge: 10 * 60, // 10 min
  });

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar"],
    state,
  });

  return NextResponse.redirect(authUrl);
}
