// app/api/auth/signup/route.ts
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabaseClients";

type SignupBody = {
  email?: string;
  password?: string;
  sessionId?: string;
};

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as SignupBody | null;

  const email = body?.email?.trim();
  const password = body?.password;
  const sessionId = body?.sessionId?.trim();

  if (!email || !password || !sessionId) {
    return NextResponse.json(
      { error: "missing_fields" },
      { status: 400 }
    );
  }

  // ⚠️ WICHTIG: Service Role Client (nicht createClients)
  const supabase = createServiceClient();

  console.log("[SIGNUP] sessionId from body:", sessionId);

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

  // optional: Mail-Check
  if (
    subscription.email &&
    subscription.email.toLowerCase() !== email.toLowerCase()
  ) {
    console.warn("[SIGNUP] email_mismatch", {
      formEmail: email,
      stripeEmail: subscription.email,
    });

    return NextResponse.json(
      { error: "email_mismatch" },
      { status: 400 }
    );
  }

  if (subscription.user_id) {
    // jemand hat diesen Checkout schon benutzt
    return NextResponse.json(
      { error: "subscription_already_linked" },
      { status: 400 }
    );
  }

  // 2) Supabase-User anlegen (Service-Role → admin API)
  const { data: userRes, error: userErr } = await (supabase as any).auth.admin.createUser(
    {
      email,
      password,
      email_confirm: true, // wir vertrauen der Stripe-Mail
    }
  );

  if (userErr || !userRes?.user?.id) {
    console.error("signup_create_user_failed", userErr);
    return NextResponse.json(
      { error: "user_create_failed" },
      { status: 500 }
    );
  }

  const userId = userRes.user.id as string;

  // 3) Subscription mit User verknüpfen
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

  // 4) Optional: Autologin vorbereiten – Client holt sich danach normale Session per Login
  // (Autologin-Variante können wir später noch bauen, wenn du willst.)

  return NextResponse.json({ ok: true }, { status: 200 });
}
