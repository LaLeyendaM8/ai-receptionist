import Stripe from "stripe";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/stripe";
import { createServiceClient } from "@/lib/supabaseClients";

export const runtime = "nodejs";

function mapPlan(rawPlan: string | null | undefined): string {
  const plan = String(rawPlan || "").toLowerCase();

  if (plan === "faq_basic") return "faq_basic";
  if (plan === "starter") return "starter";

  return "starter";
}

function getMeteredItemIdFromSubscription(subscription: Stripe.Subscription) {
  const items = subscription.items?.data ?? [];

  const meteredItem = items.find((item) => {
    const usageType = item.price?.recurring?.usage_type;
    return usageType === "metered";
  });

  return meteredItem?.id ?? null;
}

function getFixedRecurringItemIdFromSubscription(subscription: Stripe.Subscription) {
  const items = subscription.items?.data ?? [];

  const fixedItem = items.find((item) => {
    const recurring = item.price?.recurring;
    return recurring && recurring.usage_type !== "metered";
  });

  return fixedItem?.id ?? null;
}

async function upsertSubscriptionFromStripe(params: {
  supabase: ReturnType<typeof createServiceClient>;
  stripeSubscriptionId: string;
  stripeSessionId?: string | null;
  email?: string | null;
  customerId?: string | null;
}) {
  const {
    supabase,
    stripeSubscriptionId,
    stripeSessionId = null,
    email = null,
    customerId = null,
  } = params;

  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
    expand: ["items.data.price"],
  });

  const plan = mapPlan(subscription.metadata?.plan);
  const status = subscription.status;
  const meteredSubscriptionItemId = getMeteredItemIdFromSubscription(subscription);
  const fixedSubscriptionItemId = getFixedRecurringItemIdFromSubscription(subscription);
  const includedMinutes = Number(subscription.metadata?.included_minutes || 0) || null;
  const currentPeriodStartUnix = subscription.items?.data?.[0]?.current_period_start ?? null;
const currentPeriodEndUnix = subscription.items?.data?.[0]?.current_period_end ?? null;


  const payload = {
    stripe_session_id: stripeSessionId,
    stripe_customer_id: customerId ?? (subscription.customer as string | null),
    stripe_subscription_id: subscription.id,
    stripe_fixed_subscription_item_id: fixedSubscriptionItemId,
    stripe_metered_subscription_item_id: meteredSubscriptionItemId,
    email,
    plan,
    status,
    included_minutes: includedMinutes,
    current_period_start: currentPeriodStartUnix
    ? new Date(currentPeriodStartUnix * 1000).toISOString()
    : null,
  current_period_end: currentPeriodEndUnix
    ? new Date(currentPeriodEndUnix * 1000).toISOString()
    : null,
  };

  const { error } = await supabase
    .from("stripe_subscriptions")
    .upsert(payload, {
      onConflict: "stripe_subscription_id",
    });

  if (error) {
    console.error("stripe_subscription_upsert_failed", error.message ?? error);
    throw error;
  }
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    console.error("stripe_webhook_missing_signature_or_secret");
    return new NextResponse("Missing signature or secret", { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error("stripe_webhook_verify_error", err?.message ?? err);
    return new NextResponse(`Webhook Error: ${err?.message ?? "unknown"}`, {
      status: 400,
    });
  }

  try {
    const supabase = createServiceClient();

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const sessionId = session.id;
        const customerId = session.customer as string | null;
        const subscriptionId = session.subscription as string | null;
        const email =
          session.customer_details?.email ||
          (session.customer_email as string | null) ||
          null;

        if (!sessionId || !subscriptionId) {
          console.error("checkout_session_completed_missing_ids", {
            sessionId,
            subscriptionId,
          });
          break;
        }

        await upsertSubscriptionFromStripe({
          supabase,
          stripeSubscriptionId: subscriptionId,
          stripeSessionId: sessionId,
          email,
          customerId,
        });

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;

        await upsertSubscriptionFromStripe({
          supabase,
          stripeSubscriptionId: subscription.id,
          customerId: subscription.customer as string | null,
        });

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;

        const { error } = await supabase
          .from("stripe_subscriptions")
          .update({
            status: "canceled",
          })
          .eq("stripe_subscription_id", subscriptionId);

        if (error) {
          console.error(
            "stripe_subscription_deleted_update_failed",
            error.message ?? error
          );
          throw error;
        }

        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("stripe_webhook_handler_error", err?.message ?? err);
    return new NextResponse("Webhook handler error", { status: 500 });
  }
}