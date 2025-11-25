// app/api/stripe/checkout/route.ts
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClients } from "@/lib/supabaseClients";
import { getCurrentUserId } from "@/lib/authServer";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const supabase = await createClients();
    const userId = await getCurrentUserId(supabase);

    if (!userId) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    // 1) Client zum aktuellen User holen
    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select("id, name")
      .eq("owner_user", userId)
      .maybeSingle();

    if (clientErr || !client?.id) {
      console.error("stripe_checkout_client_not_found", clientErr);
      return NextResponse.json(
        { error: "client_not_found" },
        { status: 400 }
      );
    }

    const baseUrl =
      process.env.PUBLIC_BASE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    // 2) Checkout-Session bauen
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_creation: "always",
      // Setup Fee (one-time) + monatliches Abo
      line_items: [
        {
          price: process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY!, // Abo
          quantity: 1,
        },
        {
          price: process.env.NEXT_PUBLIC_STRIPE_PRICE_SETUP!, // Einmalige Setup-Fee
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/billing/cancel`,
      metadata: {
        client_id: client.id,
        user_id: userId,
      },
      subscription_data: {
        metadata: {
          client_id: client.id,
          user_id: userId,
        },
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "no_session_url" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("stripe_checkout_error", err);
    return NextResponse.json(
      { error: "stripe_checkout_error", details: err?.message },
      { status: 500 }
    );
  }
}
