import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PlanKey = "faq_basic" | "starter";

type PlanConfig = {
  monthlyPriceId: string;
  setupPriceId: string;
  meteredPriceId: string;
  displayName: string;
  includedMinutes: number;
};

function getBaseUrl() {
  const baseUrl =
    process.env.PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;

  if (!baseUrl) {
    throw new Error("PUBLIC_BASE_URL or NEXT_PUBLIC_APP_URL is missing");
  }

  return baseUrl.replace(/\/$/, "");
}

function getPlanConfig(plan: PlanKey): PlanConfig {
  const plans: Record<PlanKey, PlanConfig> = {
    faq_basic: {
      monthlyPriceId: process.env.STRIPE_PRICE_FAQ_BASIC_MONTHLY || "",
      setupPriceId: process.env.STRIPE_PRICE_FAQ_BASIC_SETUP || "",
      meteredPriceId: process.env.STRIPE_PRICE_FAQ_BASIC_METERED || "",
      displayName: "FAQ Basic",
      includedMinutes: 150,
    },
    starter: {
      monthlyPriceId: process.env.STRIPE_PRICE_STARTER_MONTHLY || "",
      setupPriceId: process.env.STRIPE_PRICE_STARTER_SETUP || "",
      meteredPriceId: process.env.STRIPE_PRICE_STARTER_METERED || "",
      displayName: "Starter",
      includedMinutes: 300,
    },
  };

  const config = plans[plan];

  if (
    !config.monthlyPriceId ||
    !config.setupPriceId ||
    !config.meteredPriceId
  ) {
    throw new Error(`Missing Stripe price ids for plan: ${plan}`);
  }

  return config;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { plan?: PlanKey }
      | null;

    const plan = body?.plan;

    if (!plan || (plan !== "faq_basic" && plan !== "starter")) {
      return NextResponse.json({ error: "invalid_plan" }, { status: 400 });
    }

    const baseUrl = getBaseUrl();
    const config = getPlanConfig(plan);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],

      line_items: [
        {
          // fester monatlicher Planpreis
          price: config.monthlyPriceId,
          quantity: 1,
        },
        {
          // einmalige Setup Fee
          price: config.setupPriceId,
          quantity: 1,
        },
        {
          // usage based Zusatzminuten
          price: config.meteredPriceId,
        },
      ],

      metadata: {
        plan,
        included_minutes: String(config.includedMinutes),
        display_name: config.displayName,
      },

      subscription_data: {
        metadata: {
          plan,
          included_minutes: String(config.includedMinutes),
          display_name: config.displayName,
        },
      },

      success_url: `${baseUrl}/signup?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/#pricing`,
    });

    if (!session.url) {
      return NextResponse.json({ error: "no_session_url" }, { status: 500 });
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