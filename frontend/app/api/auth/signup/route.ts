// app/api/auth/signup/route.ts
import { NextResponse } from "next/server";
import { createClients } from "@/lib/supabaseClients";

type SignupBody = {
  email: string;
  password: string;
  sessionId: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as SignupBody | null;
  if (!body) {
    return NextResponse.json({ error: "missing_body" }, { status: 400 });
  }

  const email = body.email?.trim();
  const password = body.password;
  const sessionId = body.sessionId?.trim();

  if (!email || !password || !sessionId) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const supabase = await createClients();

  // 1) Stripe-Subscription zu dieser Checkout-Session finden

  console.log("[SIGNUP] sessionId from body:", sessionId);
  const {data: lastSubs } = await supabase
   .from("stripe_subscriptions")
   .select("id, stripe_session_id, email, status, user_id, created_at")
   .order("created_at", {ascending: false})
   .limit(5);
  console.log("[SIGNUP] last stripe_subscriptions rows:", lastSubs);

  
  const { data: subscription, error: subErr } = await supabase
    .from("stripe_subscriptions")
    .select("id, email, status, user_id, stripe_session_id, stripe_customer_id, stripe_subscription_id, client_id")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();

  if (subErr) {
    console.error("signup_find_subscription_failed", subErr);
    return NextResponse.json(
      { error: "subscription_lookup_failed" },
      { status: 500 }
    );
  }

  if (!subscription) {
    return NextResponse.json(
      { error: "subscription_not_found" },
      { status: 400 }
    );
  }

  // E-Mail muss übereinstimmen
  if (subscription.email.toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json(
      { error: "email_mismatch" },
      { status: 400 }
    );
  }

  // Checkout wurde bereits benutzt?
  if (subscription.user_id) {
    return NextResponse.json(
      { error: "subscription_already_linked" },
      { status: 400 }
    );
  }

  // 2) User erstellen (Admin-API)
  const { data: userRes, error: userErr } = await (supabase as any).auth.admin.createUser(
    {
      email,
      password,
      email_confirm: true,
    }
  );

  if (userErr || !userRes?.user?.id) {
    console.error("signup_create_user_failed", userErr);
    return NextResponse.json(
      { error: "user_create_failed" },
      { status: 500 }
    );
  }

  const userId = userRes.user.id;

  // 3) Subscription mit dem User verknüpfen
  const { error: linkErr } = await supabase
    .from("stripe_subscriptions")
    .update({ user_id: userId })
    .eq("id", subscription.id);

  if (linkErr) {
    console.error("signup_link_subscription_failed", linkErr);
    return NextResponse.json(
      { error: "subscription_link_failed" },
      { status: 500 }
    );
  }

  // 4) AUTOLOGIN – Kunde sofort einloggen!
  const { data: sessionData, error: loginErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (loginErr || !sessionData.session) {
    console.error("autologin_failed", loginErr);
    return NextResponse.json(
      { error: "autologin_failed" },
      { status: 500 }
    );
  }

  // 5) Cookies setzen
  const res = NextResponse.json({ ok: true });

  // Access & Refresh Token setzen (Supabase Standard)
  res.cookies.set("sb-access-token", sessionData.session.access_token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });

  res.cookies.set("sb-refresh-token", sessionData.session.refresh_token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });

  return res;
}
