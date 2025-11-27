// frontend/lib/subscriptionHelpers.ts

import type { TypedSupabaseClient } from "@/lib/supabaseServer";
import { createServerClientTyped } from "@/lib/supabaseServer";
import { createServiceClient } from "@/lib/supabaseClients";

// Welche Stripe-Status gelten als „Abo aktiv“?
const ACTIVE_SUB_STATUSES = ["active", "trialing"] as const;

type ClientRow = {
  id: string;
  owner_user: string;
  stripe_status: string | null;
  stripe_plan: string | null;
};

type StripeSubscriptionRow = {
  id: string;
  user_id: string | null;
  client_id: string | null;
  status: string | null;
  plan: string | null;
};

/* -------------------------------------------------------------------------- */
/*  A) Hilfsfunktionen für User-basierten Flow (Dashboard etc.)              */
/* -------------------------------------------------------------------------- */

/**
 * Holt den Client des eingeloggten Users (über owner_user).
 * Nutzt RLS (Typed Supabase Client).
 */
export async function getClientForUser(
  supabase: TypedSupabaseClient,
  userId: string
): Promise<ClientRow | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("id, owner_user, stripe_status, stripe_plan")
    .eq("owner_user", userId)
    .maybeSingle();

  if (error) {
    console.error("[SUBSCRIPTIONS] getClientForUser error", error);
    return null;
  }

  return data as ClientRow | null;
}

/**
 * True, wenn der Client ein aktives Abo hat.
 */
export function clientHasActiveSubscription(client: ClientRow | null): boolean {
  if (!client?.stripe_status) return false;
  return ACTIVE_SUB_STATUSES.includes(client.stripe_status as any);
}

/**
 * Convenience: holt intern Supabase + UserId und gibt { client, hasActiveSub } zurück.
 * Kann direkt im Dashboard-Layout verwendet werden.
 */
export async function getCurrentClientWithSubStatus() {
  const supabase = await createServerClientTyped();
  const { getCurrentUserId } = await import("@/lib/authServer");

  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return { client: null, hasActiveSub: false };
  }

  const client = await getClientForUser(supabase, userId);
  const hasActiveSub = clientHasActiveSubscription(client);

  return { client, hasActiveSub };
}

/* -------------------------------------------------------------------------- */
/*  B) Hilfsfunktionen für service-role Flows (Twilio etc.)                  */
/* -------------------------------------------------------------------------- */

/**
 * Holt für einen Client (id) die passende Subscription (z.B. für Twilio-Calls).
 * Nutzt Service-Role (ohne Login, ohne RLS).
 */
export async function getActiveSubscriptionForClient(
  clientId: string
): Promise<StripeSubscriptionRow | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("stripe_subscriptions")
    .select("id, user_id, client_id, status, plan")
    .eq("client_id", clientId)
    .in("status", ACTIVE_SUB_STATUSES as any)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[SUBSCRIPTIONS] getActiveSubscriptionForClient error", error);
    return null;
  }

  return data as StripeSubscriptionRow | null;
}

/**
 * Später praktisch in Twilio-Routen:
 * gibt true/false zurück, ob der Client telefonieren darf.
 */
export async function clientHasActiveSubById(clientId: string): Promise<boolean> {
  const sub = await getActiveSubscriptionForClient(clientId);
  return !!sub;
}
