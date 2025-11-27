// app/api/ai/train/route.ts
import { NextResponse } from "next/server";
import { createClients } from "@/lib/supabaseClients";
import { getCurrentUserId } from "@/lib/authServer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const supabase = await createClients();
    const userId = await getCurrentUserId(supabase);

    if (!userId) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    // 1) Client zu diesem User holen
    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select(
        "id, name, phone, email, notification_email, timezone, industry"
      )
      .eq("owner_user", userId)
      .maybeSingle();

    if (clientErr || !client) {
      console.error("[AI-TRAIN] client error", clientErr);
      return NextResponse.json(
        { error: "client_not_found" },
        { status: 400 }
      );
    }

    const clientId = client.id;

    // 2) Business-Daten holen
    const [{ data: hours }, { data: services }, { data: faqs }] =
      await Promise.all([
        supabase
          .from("business_hours")
          .select("weekday, open_min, close_min, is_closed")
          .eq("client_id", clientId)
          .order("weekday", { ascending: true }),
        supabase
          .from("services")
          .select("name, duration_min, price_cents, active")
          .eq("client_id", clientId)
          .order("name", { ascending: true }),
        supabase
          .from("client_faqs")
          .select("question, answer, active")
          .eq("client_id", clientId)
          .order("id", { ascending: true }),
      ]);

    // 3) Profil-Text bauen (inkl. Branche)
    const lines: string[] = [];

    lines.push(
      `Unternehmen: ${client.name}`,
      `Branche: ${client.industry || "nicht angegeben"}`,
      `Zeitzone: ${client.timezone}`,
      `Telefon: ${client.phone}`,
      `Öffentliche E-Mail: ${client.email}`,
      ""
    );

    if (hours && hours.length > 0) {
      const weekdayNames = [
        "Montag",
        "Dienstag",
        "Mittwoch",
        "Donnerstag",
        "Freitag",
        "Samstag",
        "Sonntag",
      ];
      lines.push("Öffnungszeiten:");
      for (const h of hours) {
        const name = weekdayNames[h.weekday] ?? `Tag ${h.weekday}`;
        if (h.is_closed) {
          lines.push(`- ${name}: geschlossen`);
        } else {
          const open = minutesToTime(h.open_min);
          const close = minutesToTime(h.close_min);
          lines.push(`- ${name}: ${open} – ${close}`);
        }
      }
      lines.push("");
    }

    if (services && services.length > 0) {
      lines.push("Dienstleistungen:");
      for (const s of services) {
        const activeText = s.active ? "" : " (inaktiv)";
        const price =
          typeof s.price_cents === "number"
            ? (s.price_cents / 100).toFixed(2).replace(".", ",") + " €"
            : "Preis nach Absprache";
        lines.push(
          `- ${s.name}: ca. ${s.duration_min} Minuten, Preis: ${price}${activeText}`
        );
      }
      lines.push("");
    }

    if (faqs && faqs.length > 0) {
      lines.push("FAQs (für Antworten am Telefon):");
      for (const f of faqs) {
        if (!f.active) continue;
        lines.push(`Q: ${f.question}`);
        lines.push(`A: ${f.answer}`);
        lines.push("");
      }
    }

    const profileText = lines.join("\n").trim();

    // 4) Profil im Client speichern
    const { error: updateErr } = await supabase
      .from("clients")
      .update({ ai_profile: profileText })
      .eq("id", clientId);

    if (updateErr) {
      console.error("[AI-TRAIN] update error", updateErr);
      return NextResponse.json(
        { error: "update_failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[AI-TRAIN] unexpected", err);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}

function minutesToTime(min: number | null): string {
  if (min == null) return "-";
  const hh = Math.floor(min / 60)
    .toString()
    .padStart(2, "0");
  const mm = (min % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}