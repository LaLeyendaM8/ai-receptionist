// app/api/auth/signup/route.ts
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabaseClients";

type SignupBody = {
  email?: string;
  password?: string;
  sessionId?: string;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// MVP: harte Status-Whitelist (verhindert "Datensatz existiert => Signup ok")
const OK_STATUSES = new Set(["active", "trialing"]);

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as SignupBody | null;

  const email = body?.email?.trim();
  const password = body?.password;
  const sessionId = body?.sessionId?.trim();

  if (!email || !password || !sessionId) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Service Role Client (admin actions)
  const supabase = createServiceClient();

  // 1) Stripe-Subscription zu dieser Session finden
  const { data: subscription, error: subErr } = await supabase
    .from("stripe_subscriptions")
    .select(
      "id, email, status, plan, stripe_customer_id, stripe_subscription_id, stripe_session_id, user_id"
    )
    .eq("stripe_session_id", sessionId)
    .maybeSingle();

  if (subErr) {
    console.error("signup_find_subscription_failed", subErr);
    return NextResponse.json({ error: "subscription_lookup_failed" }, { status: 500 });
  }

  if (!subscription) {
    return NextResponse.json({ error: "subscription_not_found" }, { status: 400 });
  }

  // 1.1) Status muss wirklich aktiv sein (oder trialing)
  const status = String(subscription.status ?? "").toLowerCase();
  if (!OK_STATUSES.has(status)) {
    // Wichtig: keine sessionId loggen
    return NextResponse.json({ error: "subscription_not_active" }, { status: 403 });
  }

  // 1.2) optional: Mail-Check
  if (subscription.email && subscription.email.toLowerCase() !== email.toLowerCase()) {
    // kein sensitiver Log-Content
    return NextResponse.json({ error: "email_mismatch" }, { status: 400 });
  }

  if (subscription.user_id) {
    // jemand hat diesen Checkout schon benutzt
    return NextResponse.json({ error: "subscription_already_linked" }, { status: 400 });
  }

  // 2) Supabase-User anlegen (Service-Role → admin API)
  const { data: userRes, error: userErr } = await (supabase as any).auth.admin.createUser({
    email,
    password,
    email_confirm: true, // MVP: du vertraust Stripe-Mail / Email-Match
  });

  if (userErr || !userRes?.user?.id) {
    console.error("signup_create_user_failed", userErr);
    return NextResponse.json({ error: "user_create_failed" }, { status: 500 });
  }

  const userId = userRes.user.id as string;

  // 3) Subscription mit User verknüpfen
  //    (MVP: simple update; später optional "link only if user_id is null" atomically via RPC)
  const { data: updated, error: linkErr } = await supabase
    .from("stripe_subscriptions")
    .update({ user_id: userId })
    .eq("id", subscription.id)
    .is("user_id", null) // verhindert "double link" bei parallel requests
    .select("id")
    .maybeSingle();

  if (linkErr) {
    console.error("signup_link_subscription_failed", linkErr);
    return NextResponse.json({ error: "subscription_link_failed" }, { status: 500 });
  }

  if (!updated) {
    // race: jemand anders hat inzwischen gelinkt
    return NextResponse.json({ error: "subscription_already_linked" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, email, userId }, { status: 200 });
}
