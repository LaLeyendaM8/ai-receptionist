import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getBaseUrl } from "@/lib/getBaseUrl";
import { createClients } from "@/lib/supabaseClients";
import { getCurrentUserId } from "@/lib/authServer";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateStr = url.searchParams.get("state");
    if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });

    const redirectUri = `${getBaseUrl(req)}/api/google/oauth/callback`;
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      redirectUri
    );

    // 1) Code -> Tokens
    const { tokens } = await oauth2.getToken({ code, redirect_uri: redirectUri });

    // 2) User bestimmen (DEV_USER_ID muss uuid sein)
    const supabase = await createClients();
      const userId = await getCurrentUserId(supabase);
          if (!userId) {
            return NextResponse.json(
              { error: "unauthenticated" },
              { status: 401 }
            );
          }

    // 3) Tokens mergen & speichern (refresh_token nie verlieren)
    
    const { data: existing } = await supabase
      .from("google_tokens")
      .select("*")
      .eq("user_id", userId)
      .single();

    const payload = {
      user_id: userId,
      access_token: tokens.access_token ?? existing?.access_token ?? null,
      refresh_token: tokens.refresh_token ?? existing?.refresh_token ?? null,
      expiry_date: tokens.expiry_date ?? existing?.expiry_date ?? null,
      token_type: tokens.token_type ?? existing?.token_type ?? null,
      scope: tokens.scope ?? existing?.scope ?? null,
      raw: tokens as any,
      updated_at: new Date().toISOString(),
    };

    const { error: upErr } = await supabase
      .from("google_tokens")
      .upsert(payload, { onConflict: "user_id" });

    if (upErr) {
      console.error("UPSERT ERROR:", upErr);
      return NextResponse.json({ error: "db_upsert_failed", details: upErr.message }, { status: 500 });
    }

    // 4) zurück zur Testseite
    return NextResponse.redirect(`${getBaseUrl(req)}/onboarding?calendar_connected=1`);
  } catch (e: any) {
    console.error("oauth callback error:", e?.response?.data || e);
    return NextResponse.json({ error: "callback_failed" }, { status: 400 });
  }
}
