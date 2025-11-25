// app/api/google/auth-status/route.ts
import { NextResponse } from "next/server";
import { createClients } from "@/lib/supabaseClients";
import { getCurrentUserId } from "@/lib/authServer";

export async function GET() {
  const  supabase  = await createClients();
  const userId = await getCurrentUserId(supabase);
    if (!userId) {
      return NextResponse.json(
        { error: "unauthenticated" },
        { status: 401 }
      );
    }

  const { data, error } = await supabase
    .from("google_tokens")
    .select("user_id, access_token, refresh_token, expiry_date")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const connected = !!data?.refresh_token || !!data?.access_token;
  return NextResponse.json({ ok: true, connected });
}
