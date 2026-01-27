import { NextResponse } from "next/server";
import { google } from "googleapis";
import { cookies } from "next/headers";

import { getBaseUrl } from "@/lib/getBaseUrl";
import { createClients, createServiceClient } from "@/lib/supabaseClients";
import { getCurrentUserId } from "@/lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "gcal_oauth_state";

type OAuthState = {
  userId?: string;
  nonce?: string;
  returnTo?: string;
};

function decodeState(stateStr: string): OAuthState {
  const raw = Buffer.from(stateStr, "base64url").toString("utf8");
  return JSON.parse(raw) as OAuthState;
}

function safeReturnTo(path: string | undefined) {
  // nur relative pfade erlauben (security)
  if (!path) return null;
  if (!path.startsWith("/")) return null;
  if (path.startsWith("//")) return null;
  // optional: harte whitelist
  const allowed = new Set(["/onboarding", "/dashboard/settings"]);
  if (allowed.has(path)) return path;
  return null;
}
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateStr = url.searchParams.get("state") ?? "";

  if (!code) return NextResponse.json({ error: "missing_code" }, { status: 400 });
  if (!stateStr) return NextResponse.json({ error: "missing_state" }, { status: 400 });

  // ✅ must still be logged in (prevents account-linking)
  const supabaseUser = await createClients();
  const currentUserId = await getCurrentUserId(supabaseUser);
  if (!currentUserId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // ✅ validate state
  let state: OAuthState;
  try {
    state = decodeState(stateStr);
  } catch {
    return NextResponse.json({ error: "invalid_state" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const cookieNonce = cookieStore.get(STATE_COOKIE)?.value ?? "";

  if (!state?.nonce || !cookieNonce || state.nonce !== cookieNonce) {
    return NextResponse.json({ error: "state_nonce_mismatch" }, { status: 403 });
  }

  if (!state?.userId || state.userId !== currentUserId) {
    return NextResponse.json({ error: "state_user_mismatch" }, { status: 403 });
  }

  // clear nonce cookie
  cookieStore.set({
    name: STATE_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/google/oauth",
    maxAge: 0,
  });

  const base = getBaseUrl(req);
  const redirectUri = `${base}/api/google/oauth/callback`;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "missing_google_env" }, { status: 500 });
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const { tokens } = await oauth2Client.getToken(code);

  // store tokens (service client ok, we’re binding to currentUserId explicitly)
  const supabase = createServiceClient();
  const { error } = await supabase.from("google_tokens").upsert({
    user_id: currentUserId,
    access_token: tokens.access_token ?? null,
    refresh_token: tokens.refresh_token ?? null,
    scope: tokens.scope ?? null,
    token_type: tokens.token_type ?? null,
    expiry_date: tokens.expiry_date ?? null,
  });

  if (error) {
    return NextResponse.json({ error: "token_store_failed", details: error.message }, { status: 500 });
  }

  const returnTo = safeReturnTo(state?.returnTo) ?? "/onboarding";
  return NextResponse.redirect(new URL(`${returnTo}?connected=1`, req.url));
}
