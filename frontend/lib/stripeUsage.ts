import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabaseClients";

export async function reportCallUsage(params: {
  clientId: string;
  twilioCallSid: string;
  durationSeconds: number;
  callStartedAt?: string | null;
  callEndedAt?: string | null;
}) {
  const {
    clientId,
    twilioCallSid,
    durationSeconds,
    callStartedAt = null,
    callEndedAt = null,
  } = params;

  const supabase = createServiceClient();

  const billedMinutes = Math.ceil(durationSeconds / 60);

  const { data: subscription, error: subError } = await supabase
    .from("stripe_subscriptions")
    .select(`
      stripe_customer_id,
      stripe_subscription_id,
      stripe_metered_subscription_item_id,
      included_minutes,
      current_period_start,
      current_period_end,
      client_id,
      status
    `)
    .eq("client_id", clientId)
    .in("status", ["active", "trialing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subError) {
    throw subError;
  }

  if (!subscription?.stripe_customer_id) {
    throw new Error("No Stripe customer id found");
  }

  if (!subscription?.stripe_metered_subscription_item_id) {
    throw new Error("No metered subscription item found");
  }

  const periodStart = subscription.current_period_start;
  const periodEnd = subscription.current_period_end;
  const includedMinutes = Number(subscription.included_minutes || 0);

  if (!periodStart || !periodEnd) {
    throw new Error("Missing billing period on subscription");
  }

  // Idempotenz: Call nicht doppelt verarbeiten
  const { data: existingUsage } = await supabase
    .from("call_usage_events")
    .select("id")
    .eq("twilio_call_sid", twilioCallSid)
    .maybeSingle();

  if (existingUsage) {
    return { ok: true, skipped: true };
  }

  const usageTimeField = callEndedAt ? "call_ended_at" : "created_at";

  // Bisherige Nutzung in dieser Billing Period
  const { data: usageRows, error: usageError } = await supabase
    .from("call_usage_events")
    .select("billed_minutes")
    .eq("client_id", clientId)
    .gte(usageTimeField, periodStart)
    .lt(usageTimeField, periodEnd);

  if (usageError) {
    throw usageError;
  }

  const usedMinutesSoFar = (usageRows || []).reduce(
    (sum, row) => sum + Number(row.billed_minutes || 0),
    0
  );

  const includedRemaining = Math.max(includedMinutes - usedMinutesSoFar, 0);
  const billableMinutes = Math.max(billedMinutes - includedRemaining, 0);

  const { error: insertError } = await supabase
    .from("call_usage_events")
    .insert({
      client_id: clientId,
      stripe_subscription_id: subscription.stripe_subscription_id,
      stripe_metered_subscription_item_id:
        subscription.stripe_metered_subscription_item_id,
      twilio_call_sid: twilioCallSid,
      duration_seconds: durationSeconds,
      billed_minutes: billedMinutes,
      included_minutes_at_event: includedMinutes,
      billable_minutes: billableMinutes,
      call_started_at: callStartedAt,
      call_ended_at: callEndedAt,
      billing_period_start: periodStart,
      billing_period_end: periodEnd,
    });

  if (insertError) {
    throw insertError;
  }

  if (billableMinutes > 0) {
    await stripe.billing.meterEvents.create({
      event_name: "receptaai_call_minutes",
      payload: {
        stripe_customer_id: subscription.stripe_customer_id,
        value: String(billableMinutes),
      },
    });
  }

  return {
    ok: true,
    billedMinutes,
    usedMinutesSoFar,
    includedMinutes,
    billableMinutes,
  };
}