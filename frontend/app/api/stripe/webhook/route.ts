// app/api/stripe/webhook/route.ts
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { createClients } from "@/lib/supabaseClients";

export const runtime = "nodejs"; // wichtig für raw body

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    console.error("stripe_webhook_missing_signature_or_secret");
    return new NextResponse("Missing signature", { status: 400 });
  }

  let event: any;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error("stripe_webhook_verify_error", err?.message);
    return new NextResponse(`Webhook Error: ${err?.message}`, {
      status: 400,
    });
  }

  try {
    const supabase = await createClients();

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const clientId = session.metadata?.client_id;
        const customerId = session.customer as string | null;
        const subscriptionId = session.subscription as string | null;

        if (clientId && customerId && subscriptionId) {
          const { error } = await supabase
            .from("clients")
            .update({
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              stripe_status: "active",
              stripe_plan: "paid",
            })
            .eq("id", clientId);

          if (error) {
            console.error("stripe_webhook_client_update_failed", error);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const clientId = subscription.metadata?.client_id;

        if (clientId) {
          const { error } = await supabase
            .from("clients")
            .update({
              stripe_subscription_id: null,
              stripe_status: "canceled",
              stripe_plan: "none",
            })
            .eq("id", clientId);

          if (error) {
            console.error("stripe_subscription_delete_update_failed", error);
          }
        }
        break;
      }

      default:
        // andere Events erstmal ignorieren
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("stripe_webhook_handler_error", err);
    return new NextResponse("Webhook handler error", { status: 500 });
  }
}
