import { SupabaseClient } from "@supabase/supabase-js";

export type ServiceInfo = {
  id: string;
  title: string;
  durationMin: number;
  defaultStaffId: string | null;
};

function mapServiceRow(data: any): ServiceInfo {
  return {
    id: data.id,
    title: data.title,
    durationMin: data.duration_min ?? 30,
    defaultStaffId: data.default_staff_id ?? null,
  };
}

export async function getServiceByMessage(
  supabase: SupabaseClient,
  clientId: string,
  message: string
): Promise<ServiceInfo | null> {
  const term = (message || "").trim();

  // ✅ IMPORTANT: avoid ilike "%%" → would match everything
  if (!term) return null;

  // 1) Try exact match first (case-insensitive)
  {
    const { data, error } = await supabase
      .from("services")
      .select("id, title, duration_min, default_staff_id")
      .eq("client_id", clientId)
      .ilike("title", term)
      .limit(1);

    if (error) {
      console.error("getServiceByMessage (exact) error", error);
      return null;
    }

    if (data && data.length > 0) {
      return mapServiceRow(data[0]);
    }
  }

  // 2) Fallback: contains match (case-insensitive) with deterministic pick
  {
    const { data, error } = await supabase
      .from("services")
      .select("id, title, duration_min, default_staff_id")
      .eq("client_id", clientId)
      .ilike("title", `%${term}%`)
      .limit(10);

    if (error) {
      console.error("getServiceByMessage (contains) error", error);
      return null;
    }

    if (!data || data.length === 0) return null;

    // deterministic choice: shortest title tends to be the "base" service
    data.sort((a: any, b: any) => (a.title?.length ?? 0) - (b.title?.length ?? 0));

    return mapServiceRow(data[0]);
  }
}
