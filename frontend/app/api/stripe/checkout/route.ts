// app/api/stripe/checkout/route.ts
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const baseUrl =
      process.env.PUBLIC_BASE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const monthlyPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY;
    const setupPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_SETUP;

    if (!monthlyPriceId || !setupPriceId) {
      console.error("stripe_price_ids_missing", {
        monthlyPriceId,
        setupPriceId,
      });
      return NextResponse.json(
        { error: "price_ids_missing" },
        { status: 500 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          // Monatsabo
          price: monthlyPriceId,
          quantity: 1,
        },
        {
          // Einmalige Setup-Gebühr
          price: setupPriceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/signup?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/#pricing`,
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
      {
        error: "stripe_checkout_error",
        details: err?.message ?? "Unknown error",
      },
      { status: 500 }
    );
  }
}
