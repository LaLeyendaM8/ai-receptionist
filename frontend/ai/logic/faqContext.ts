// frontend/ai/logic/faqContext.ts
import { createClients } from "@/lib/supabaseClients";

type BuildFaqContextOptions = {
  userId?: string | null;
  clientId?: string | null;
};

/**
 * Baut einen FAQ-Kontext-String aus Firmendaten, Öffnungszeiten, Services & FAQs.
 * Kann entweder über userId (Owner → Client) ODER direkt über clientId aufgerufen werden.
 */
export async function buildFaqContext(
  opts: BuildFaqContextOptions
): Promise<{ clientId: string | null; text: string }> {
  const supabase = await createClients();
  const { userId, clientId: clientIdArg } = opts;

  // 1) Client laden – entweder direkt per clientId oder über owner_user = userId
  let clientRow: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    timezone: string | null;
    address: string | null;
  } | null = null;

  if (clientIdArg) {
    const { data } = await supabase
      .from("clients")
      .select("id, name, email, phone, timezone, address")
      .eq("id", clientIdArg)
      .maybeSingle();
    clientRow = data ?? null;
  } else if (userId) {
    const { data } = await supabase
      .from("clients")
      .select("id, name, email, phone, timezone, address")
      .eq("owner_user", userId)
      .maybeSingle();
    clientRow = data ?? null;
  } else {
    // Weder userId noch clientId → kein Kontext möglich
    return {
      clientId: null,
      text: "Kein Firmenkontext vorhanden.",
    };
  }

  if (!clientRow) {
    return {
      clientId: null,
      text: "Kein Firmenkontext vorhanden.",
    };
  }

  const clientId = clientRow.id;

  // 2) Öffnungszeiten laden
  const { data: hours } = await supabase
    .from("business_hours")
    .select("weekday, open_min, close_min, is_closed")
    .eq("client_id", clientId);

  // 3) Services laden
  const { data: services } = await supabase
    .from("services")
    .select("name, duration_min, price_cents, active")
    .eq("client_id", clientId)
    .eq("active", true);

  // 4) FAQs laden
  const { data: faqs } = await supabase
    .from("faqs")
    .select("question, answer")
    .eq("client_id", clientId)
    .eq("active", true);

  // 5) Öffnungszeiten-Text bauen
  const W = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const hoursText =
    hours
      ?.sort((a, b) => a.weekday - b.weekday)
      .map((h) => {
        if (h.is_closed) return `${W[h.weekday]}: geschlossen`;
        const openH = Math.floor(h.open_min / 60)
          .toString()
          .padStart(2, "0");
        const openM = (h.open_min % 60).toString().padStart(2, "0");
        const closeH = Math.floor(h.close_min / 60)
          .toString()
          .padStart(2, "0");
        const closeM = (h.close_min % 60).toString().padStart(2, "0");
        return `${W[h.weekday]}: ${openH}:${openM}–${closeH}:${closeM}`;
      })
      .join("\n") ?? "";

  // 6) Services-Text bauen
  const svcText =
    services
      ?.map((s) => {
        const euro =
          s.price_cents != null
            ? (s.price_cents / 100).toFixed(2) + " €"
            : "-";
        const dur =
          s.duration_min != null ? `${s.duration_min} Min` : "? Min";
        return `${s.name}: ${dur}, ${euro}`;
      })
      .join("\n") ?? "";

  // 7) FAQ-Text bauen
  const faqText =
    faqs
      ?.map((f) => `Frage: ${f.question}\nAntwort: ${f.answer}`)
      .join("\n\n---\n") ?? "";

  // 8) Gesamt-Kontext-String
  const contactLine = `Kontakt: ${clientRow.phone ?? "-"} | ${
    clientRow.email ?? "-"
  } | TZ: ${clientRow.timezone ?? "Europe/Berlin"}`;

  const text = [
    `Firma: ${clientRow.name ?? "-"}`,
    contactLine,
    clientRow.address ? `Adresse: ${clientRow.address}` : "",
    "",
    "Öffnungszeiten:",
    hoursText || "-",
    "",
    "Leistungen:",
    svcText || "-",
    "",
    "FAQs:",
    faqText || "Keine vordefinierten FAQs",
  ]
    .filter(Boolean)
    .join("\n");

  return { clientId, text };
}
