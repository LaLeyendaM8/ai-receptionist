import { createClients } from "@/lib/supabaseClients";

export async function getServiceByMessage(clientId: string, message: string) {
  const supabase = createClients();
  const { data } = await supabase
    .from("services")
    .select("name,duration_min")
    .eq("client_id", clientId)
    .eq("active", true);

  if (!data?.length) return { title: "Termin", durationMin: 30 };

  // simple fuzzy contains
  const lowered = message.toLowerCase();
  const hit = data.find(s => lowered.includes(s.name.toLowerCase()));
  if (hit) return { title: hit.name, durationMin: hit.duration_min };

  return { title: data[0].name, durationMin: data[0].duration_min }; // fallback: erster aktiver
}
