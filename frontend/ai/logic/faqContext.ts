// frontend/ai/logic/faqContext.ts
import { createClients } from "@/lib/supabaseClients";

export async function buildFaqContext(userId: string) {
  const supabase = await createClients();

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, email, phone, timezone, address")
    .eq("owner_user", userId)
    .single();

  if (!client) return { clientId: null, text: "Kein Firmenkontext vorhanden." };

  const clientId = client.id;

  const { data: hours } = await supabase
    .from("business_hours")
    .select("weekday, open_min, close_min, is_closed")
    .eq("client_id", clientId);

  const { data: services } = await supabase
    .from("services")
    .select("name, duration_min, price_cents, active")
    .eq("client_id", clientId)
    .eq("active", true);

    const { data: faqs } = await supabase
    .from("client_faqs")
    .select("question, answer")
    .eq("client_id", clientId)
    .eq("active", true);

  const wd = ["So","Mo","Di","Mi","Do","Fr","Sa"];
  const hoursText = (hours ?? [])
    .sort((a,b)=>a.weekday-b.weekday)
    .map(h => {
      if (h.is_closed) return `${wd[h.weekday]}: geschlossen`;
      const toHM = (m:number)=>`${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
      return `${wd[h.weekday]}: ${toHM(h.open_min)}–${toHM(h.close_min)}`;
    }).join(" | ");

  const svcText = (services ?? [])
    .map(s => {
      const euro = s.price_cents != null ? (s.price_cents/100).toFixed(2)+"€" : "—";
      return `${s.name} (${s.duration_min ?? "?"} Min, ${euro})`;
    }).join(" • ");

const faqText = (faqs ?? [])
    .map(f => `Frage: ${f.question}\nAntwort: ${f.answer}`)
    .join("\n---\n");

  const contact = `Kontakt: ${client.phone ?? "—"} | ${client.email ?? "—"} | TZ: ${client.timezone ?? "Europe/Berlin"}`;

  const text = [
    `Firma: ${client.name ?? "—"}`,
    contact,
    `Öffnungszeiten: ${hoursText || "—"}`,
    `Leistungen: ${svcText || "—"}`,
    `FAQs:\n${faqText || "Keine vordefinierten FAQs"}`
  ].join("\n");

  return { clientId, text };
}
