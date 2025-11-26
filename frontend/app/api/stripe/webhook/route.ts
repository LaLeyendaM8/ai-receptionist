// app/api/stripe/webhook/route.ts
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabaseClients";

export const runtime = "nodejs";

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
    console.log("stripe_webhook_event_type", event.type);
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

        // Für MVP: alles "starter"
        const plan = "starter";
        const status =
          (session.status as string | null) ||
          (subscriptionId ? "active" : "incomplete");

        console.log("stripe_checkout_completed_payload", {
          sessionId,
          customerId,
          subscriptionId,
          email,
          plan,
          status,
        });

        if (!sessionId) {
          console.error("stripe_webhook_missing_session_id");
          break;
        }

        const { data, error } = await supabase
          .from("stripe_subscriptions")
          .upsert(
            {
              stripe_session_id: sessionId,
              stripe_customer_id: customerId ?? null,
              stripe_subscription_id: subscriptionId ?? null,
              email,
              plan,
              status,
            },
            {
              onConflict: "stripe_session_id",
            }
          )
          .select("id");

        if (error) {
          console.error(
            "stripe_subscriptions_upsert_failed",
            error.message ?? error
          );
        } else {
          console.log("stripe_subscriptions_upsert_ok", data);
        }

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;

        console.log("stripe_subscription_deleted_event", { subscriptionId });

        if (!subscriptionId) break;

        const { data, error } = await supabase
          .from("stripe_subscriptions")
          .update({
            status: "canceled",
          })
          .eq("stripe_subscription_id", subscriptionId)
          .select("id");

        if (error) {
          console.error(
            "stripe_subscription_canceled_update_failed",
            error.message ?? error
          );
        } else {
          console.log("stripe_subscription_canceled_update_ok", data);
        }

        break;
      }

      default:
        // andere Events ignorieren wir erstmal
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("stripe_webhook_handler_error", err?.message ?? err);
    return new NextResponse("Webhook handler error", { status: 500 });
  }
}
