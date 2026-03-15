import type { SupabaseClient } from "@supabase/supabase-js";

type BuildFaqContextOptions = {
  supabase: SupabaseClient;
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
  const { supabase, userId, clientId: clientIdArg } = opts;

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

  const { data: hours } = await supabase
    .from("business_hours")
    .select("weekday, open_min, close_min, is_closed")
    .eq("client_id", clientId);

  const { data: services } = await supabase
    .from("services")
    .select("title, duration_min, price_cents, active")
    .eq("client_id", clientId)
    .eq("active", true);

  const { data: faqs } = await supabase
    .from("client_faqs")
    .select("question, answer, active")
    .eq("client_id", clientId)
    .eq("active", true);

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

  const svcText =
    services
      ?.map((s) => {
        const euro =
          s.price_cents != null
            ? (s.price_cents / 100).toFixed(2) + " €"
            : "-";
        const dur =
          s.duration_min != null ? `${s.duration_min} Min` : "? Min";

        return `${s.title}: ${dur}, ${euro}`;
      })
      .join("\n") ?? "";

  const faqText =
    faqs
      ?.map((f) => `Frage: ${f.question}\nAntwort: ${f.answer}`)
      .join("\n\n---\n") ?? "";

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