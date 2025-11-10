// app/api/google/auth-status/route.ts
import { NextResponse } from "next/server";
import { createClients } from "@/lib/supabaseClients";

export async function GET() {
  const { supabase } = createClients();
  const uid = process.env.DEV_USER_ID ?? "dev-user";

  const { data, error } = await supabase
    .from("google_tokens")
    .select("user_id, access_token, refresh_token, expiry_date")
    .eq("user_id", uid)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const connected = !!data?.refresh_token || !!data?.access_token;
  return NextResponse.json({ ok: true, connected });
}
