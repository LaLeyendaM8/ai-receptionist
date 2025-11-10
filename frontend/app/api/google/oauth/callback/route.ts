// app/api/google/oauth/callback/route.ts
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getBaseUrl } from "@/lib/getBaseUrl";
import { createClients } from "@/lib/supabaseClients";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateStr = url.searchParams.get("state");

    if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });

    // Build the SAME redirectUri as in /start
    const redirectUri = `${getBaseUrl(req)}/api/google/oauth/callback`;

    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      redirectUri
    );

    // 1) Exchange code for tokens (redirectUri must match)
    const { tokens } = await oauth2.getToken({ code, redirect_uri: redirectUri });

    // 2) Work out the user id we store under (dummy for Phase 2)
    let uid = process.env.DEV_USER_ID ?? "dev-user";
    try {
      if (stateStr) {
        const s = JSON.parse(stateStr);
        if (s?.uid) uid = s.uid;
      }
    } catch { /* ignore bad state */ }

    // 3) Save tokens
    const { supabase } = createClients();

    const { error: upErr } = await supabase
      .from("google_tokens")
      .upsert(
        {
          user_id: uid,                     // <-- MUST be a valid UUID if your column is UUID
          access_token: tokens.access_token ?? null,
          refresh_token: tokens.refresh_token ?? null,
          expiry_date: tokens.expiry_date ?? null,
          token_type: tokens.token_type ?? null,
          scope: tokens.scope ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }           // ensures real upsert behaviour
      );

    if (upErr) {
      console.error("UPSERT ERROR:", upErr);
      return NextResponse.json({ error: "db_upsert_failed", details: upErr.message }, { status: 500 });
    }

    // 4) Back to your test page
    const back = `${getBaseUrl(req)}/calendar-test?connected=1`;
    return NextResponse.redirect(back);
  } catch (e: any) {
    console.error("oauth callback error:", e?.response?.data || e);
    return NextResponse.json({ error: "callback_failed" }, { status: 400 });
  }
}
