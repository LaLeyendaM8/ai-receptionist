import type { SupabaseClient } from "@supabase/supabase-js";

export type FaqService = {
  id: string;
  title: string;
  price?: number | null;
  duration_minutes?: number | null;
  active?: boolean | null;
};

export type FaqBusinessHours = {
  weekday: number;
  open_min: number;
  close_min: number;
  is_closed: boolean;
};

export type FaqEntry = {
  id: string;
  question: string;
  answer: string;
};

export type FaqContext = {
  client: {
    id: string;
    business_name?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  } | null;
  services: FaqService[];
  businessHours: FaqBusinessHours[];
  faqs: FaqEntry[];
};

export async function buildFaqContext(
  supabase: SupabaseClient,
  clientId: string
): Promise<FaqContext> {
  const [{ data: client }, { data: services }, { data: businessHours }, { data: faqs }] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id, name, phone, email, address")
        .eq("id", clientId)
        .maybeSingle(),

      supabase
        .from("services")
        .select("id, title, price_cents, duration_min, active")
        .eq("client_id", clientId)
        .eq("active", true),

      supabase
        .from("business_hours")
        .select("weekday, open_min, close_min, is_closed")
        .eq("client_id", clientId),

      supabase
        .from("client_faqs")
        .select("id, question, answer")
        .eq("client_id", clientId),
    ]);

  return {
    client: (client as any) ?? null,
    services: ((services ?? []) as FaqService[]).filter((s) => s.active !== false),
    businessHours: (businessHours ?? []) as FaqBusinessHours[],
    faqs: (faqs ?? []) as FaqEntry[],
  };
}