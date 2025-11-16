// frontend/ai/logic/services.ts
import { SupabaseClient } from "@supabase/supabase-js";

export type ServiceInfo = {
  id: string;
  title: string;
  durationMin: number;
  defaultStaffId: string | null;
};

export async function getServiceByMessage(
  supabase: SupabaseClient,
  clientId: string,
  message: string
): Promise<ServiceInfo | null> {
  const term = (message || "").trim();

  // sehr simple Suche: Titel enthält den Begriff (kannst du später smarter machen)
  const { data, error } = await supabase
    .from("services")
    .select("id, title, duration_min, default_staff_id")
    .eq("client_id", clientId)
    .ilike("title", `%${term}%`)
    .maybeSingle();

  if (error) {
    console.error("getServiceByMessage error", error);
    return null;
  }

  if (!data) return null;

  return {
    id: data.id,
    title: data.title,
    durationMin: data.duration_min ?? 30,
    defaultStaffId: data.default_staff_id ?? null,
  };
}