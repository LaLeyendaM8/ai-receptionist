import { createClients } from "@/lib/supabaseClients";

export async function isWithinBusinessHours(clientId: string, dateISO: string, timeHM: string) {
  const supabase = createClients();

  // Wochentag ermitteln (0=So ... 6=Sa)
  const dtLocal = new Date(`${dateISO}T${timeHM}:00`);
  const wd = (dtLocal.getDay() + 0) % 7;

  const { data: row } = await supabase
    .from("business_hours")
    .select("open_min,close_min,is_closed")
    .eq("client_id", clientId)
    .eq("weekday", wd)
    .maybeSingle();

  if (!row || row.is_closed) return false;

  const [hh, mm] = timeHM.split(":").map(Number);
  const mins = hh * 60 + mm;
  return mins >= row.open_min && mins < row.close_min;
}
