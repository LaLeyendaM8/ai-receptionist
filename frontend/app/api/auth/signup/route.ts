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

// MVP: harte Status-Whitelist
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

  // 1.1) Status muss aktiv sein (oder trialing)
  const status = String(subscription.status ?? "").toLowerCase();
  if (!OK_STATUSES.has(status)) {
    return NextResponse.json({ error: "subscription_not_active" }, { status: 403 });
  }

  // 1.2) optional: Mail-Check
  if (subscription.email && subscription.email.toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json({ error: "email_mismatch" }, { status: 400 });
  }

  if (subscription.user_id) {
    return NextResponse.json({ error: "subscription_already_linked" }, { status: 400 });
  }

  // 2) Supabase-User anlegen (Service-Role → admin API)
  const { data: userRes, error: userErr } = await (supabase as any).auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (userErr || !userRes?.user?.id) {
    console.error("signup_create_user_failed", userErr);
    return NextResponse.json({ error: "user_create_failed" }, { status: 500 });
  }

  const userId = userRes.user.id as string;

  // 3) Subscription mit User verknüpfen (race-safe)
  const { data: updated, error: linkErr } = await supabase
    .from("stripe_subscriptions")
    .update({ user_id: userId })
    .eq("id", subscription.id)
    .is("user_id", null)
    .select("id")
    .maybeSingle();

  if (linkErr) {
    console.error("signup_link_subscription_failed", linkErr);
    return NextResponse.json({ error: "subscription_link_failed" }, { status: 500 });
  }

  if (!updated) {
    return NextResponse.json({ error: "subscription_already_linked" }, { status: 400 });
  }

  // Minimal Response reicht fürs Login
  return NextResponse.json({ ok: true, email }, { status: 200 });
}
