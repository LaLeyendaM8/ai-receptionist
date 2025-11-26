// app/api/debug/stripe-subs/route.ts
import { NextResponse } from "next/server";
import { createClients } from "@/lib/supabaseClients";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClients();

  const { data, error } = await supabase
    .from("stripe_subscriptions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  console.log("[DEBUG] last stripe_subscriptions rows:", data, error);

  return NextResponse.json({ data, error });
}
