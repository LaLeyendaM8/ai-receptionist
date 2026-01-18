// frontend/app/dashboard/settings/page.tsx

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  Building2,
  Clock,
  ShoppingBag,
  MessageCircle,
  PlugZap,
  Mic,
  Brain,
  LifeBuoy,
} from "lucide-react";
import { createServerClientTyped } from "@/lib/supabaseServer";
import { getCurrentUserId } from "@/lib/authServer";

// ✅ shared Google connect component (aus /app/components)
import GoogleCalendarConnect from "@/app/components/GoogleCalendarConnect";

export const dynamic = "force-dynamic";

type ClientRow = {
  id: string;
  owner_user: string;
  name: string | null;
  industry: string | null;
  phone: string | null;
  email: string | null;
  notification_email: string | null;
  timezone: string | null;
  twilio_number: string | null;
  ai_enabled: boolean | null;
  staff_enabled: boolean | null;
};

type BusinessHourRow = {
  id: string;
  client_id: string;
  weekday: number; // 0..6
  open_min: number;
  close_min: number;
  is_closed: boolean | null;
};

type ServiceRow = {
  id: string;
  client_id: string;
  title: string;
  duration_min: number;
  price_cents: number | null;
  active: boolean | null;
};

type FaqRow = {
  id: string;
  client_id: string;
  question: string;
  answer: string;
  active: boolean | null;
};

// ---------- helpers ----------
function timeToMinutes(hhmm: string) {
  const t = (hhmm ?? "").trim();
  if (!t) return 0;
  const [hh, mm] = t.split(":").map((x) => Number(x));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return 0;
  return hh * 60 + mm;
}

function minutesToTime(min: number) {
  const m = Math.max(0, Math.floor(min ?? 0));
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

const WEEKDAYS: { label: string; weekday: number }[] = [
  { label: "Sonntag", weekday: 0 },
  { label: "Montag", weekday: 1 },
  { label: "Dienstag", weekday: 2 },
  { label: "Mittwoch", weekday: 3 },
  { label: "Donnerstag", weekday: 4 },
  { label: "Freitag", weekday: 5 },
  { label: "Samstag", weekday: 6 },
];

// ---------- auth / client ----------
async function getClientStrict() {
  const supabase = await createServerClientTyped();
  const userId = await getCurrentUserId(supabase);
  if (!userId) redirect("/login");

  const { data: client, error } = await supabase
    .from("clients")
    .select("*")
    .eq("owner_user", userId)
    .maybeSingle();

  if (error || !client) {
    console.error("[SETTINGS] getClient error", error);
    redirect("/onboarding");
  }

  return client as ClientRow;
}

// ---------- actions ----------
export async function saveCompanyProfileAction(formData: FormData) {
  "use server";

  const supabase = await createServerClientTyped();
  const userId = await getCurrentUserId(supabase);
  if (!userId) redirect("/login");

  const { data: client, error } = await supabase
    .from("clients")
    .select("id")
    .eq("owner_user", userId)
    .maybeSingle();

  if (error || !client) {
    console.error("[SETTINGS] saveCompanyProfileAction get client error", error);
    return;
  }

  // ✅ map auf reale clients columns aus deiner DB (Screenshot)
  const name = String(formData.get("name") ?? "").trim() || null;
  const industry = String(formData.get("industry") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const notification_email =
    String(formData.get("notification_email") ?? "").trim() || null;
  const timezone = String(formData.get("timezone") ?? "").trim() || null;

  const { error: updErr } = await supabase
    .from("clients")
    .update({
      name,
      industry,
      phone,
      email,
      notification_email,
      timezone,
    })
    .eq("id", client.id);

  if (updErr) {
    console.error("[SETTINGS] saveCompanyProfileAction update error", updErr);
    return;
  }

  revalidatePath("/dashboard/settings");
}

export async function saveBusinessHoursAction(formData: FormData) {
  "use server";

  const supabase = await createServerClientTyped();
  const userId = await getCurrentUserId(supabase);
  if (!userId) redirect("/login");

  const { data: client, error } = await supabase
    .from("clients")
    .select("id")
    .eq("owner_user", userId)
    .maybeSingle();

  if (error || !client) {
    console.error("[SETTINGS] saveBusinessHoursAction get client error", error);
    return;
  }

  const weekdays = formData.getAll("bh_weekday").map((v) => Number(v));
  const openTimes = formData.getAll("bh_open").map((v) => String(v));
  const closeTimes = formData.getAll("bh_close").map((v) => String(v));
  const closedFlags = formData.getAll("bh_closed").map((v) => String(v) === "1");

  const rows = weekdays.map((weekday, i) => {
    const is_closed = closedFlags[i] ?? false;

    // ⚠️ deine Tabelle hat open_min/close_min NOT NULL (laut Screenshot),
    // darum bei "geschlossen" -> 0/0 speichern
    const open_min = is_closed ? 0 : timeToMinutes(openTimes[i] ?? "09:00");
    const close_min = is_closed ? 0 : timeToMinutes(closeTimes[i] ?? "17:00");

    return {
      client_id: client.id,
      weekday,
      open_min,
      close_min,
      is_closed,
    };
  });

  const { error: upsertErr } = await supabase
    .from("business_hours")
    .upsert(rows, { onConflict: "client_id,weekday" });

  if (upsertErr) {
    console.error("[SETTINGS] saveBusinessHoursAction upsert error", upsertErr);
    return;
  }

  revalidatePath("/dashboard/settings");
}

export async function saveServicesAction(formData: FormData) {
  "use server";

  const supabase = await createServerClientTyped();
  const userId = await getCurrentUserId(supabase);
  if (!userId) redirect("/login");

  const { data: client, error } = await supabase
    .from("clients")
    .select("id")
    .eq("owner_user", userId)
    .maybeSingle();

  if (error || !client) {
    console.error("[SETTINGS] saveServicesAction get client error", error);
    return;
  }

  const ids = formData.getAll("svc_id").map((v) => String(v || ""));
  const titles = formData.getAll("svc_title").map((v) => String(v || "").trim());
  const duration = formData.getAll("svc_duration").map((v) => Number(v || 0));
  const price = formData.getAll("svc_price").map((v) => String(v || ""));
  const active = formData.getAll("svc_active").map((v) => String(v) === "1");
  const del = formData.getAll("svc_delete").map((v) => String(v) === "1");

  // delete first
  const deleteIds = ids.filter((id, i) => id && del[i]);
  if (deleteIds.length > 0) {
    const { error: delErr } = await supabase
      .from("services")
      .delete()
      .eq("client_id", client.id)
      .in("id", deleteIds);

    if (delErr) {
      console.error("[SETTINGS] saveServicesAction delete error", delErr);
      return;
    }
  }

  // upsert others (exclude deleted / empty titles)
  const upsertRows = ids
    .map((id, i) => {
      if (del[i]) return null;
      const title = titles[i];
      if (!title) return null;

      const duration_min = Math.max(10, Number(duration[i] ?? 30) || 30);

      const priceStr = (price[i] ?? "").trim();
      const priceNum = priceStr ? Number(priceStr) : NaN;
      const price_cents = Number.isFinite(priceNum) ? Math.round(priceNum * 100) : null;

      const row: any = {
        client_id: client.id,
        title,
        duration_min,
        price_cents,
        active: active[i] ?? true,
      };

      if (id) row.id = id;
      return row;
    })
    .filter(Boolean) as any[];

  if (upsertRows.length > 0) {
    const { error: upsertErr } = await supabase.from("services").upsert(upsertRows);
    if (upsertErr) {
      console.error("[SETTINGS] saveServicesAction upsert error", upsertErr);
      return;
    }
  }

  revalidatePath("/dashboard/settings");
}

export async function saveFaqsAction(formData: FormData) {
  "use server";

  const supabase = await createServerClientTyped();
  const userId = await getCurrentUserId(supabase);
  if (!userId) redirect("/login");

  const { data: client, error } = await supabase
    .from("clients")
    .select("id")
    .eq("owner_user", userId)
    .maybeSingle();

  if (error || !client) {
    console.error("[SETTINGS] saveFaqsAction get client error", error);
    return;
  }

  const ids = formData.getAll("faq_id").map((v) => String(v || ""));
  const questions = formData.getAll("faq_q").map((v) => String(v || "").trim());
  const answers = formData.getAll("faq_a").map((v) => String(v || "").trim());
  const active = formData.getAll("faq_active").map((v) => String(v) === "1");
  const del = formData.getAll("faq_delete").map((v) => String(v) === "1");

  const deleteIds = ids.filter((id, i) => id && del[i]);
  if (deleteIds.length > 0) {
    const { error: delErr } = await supabase
      .from("client_faqs")
      .delete()
      .eq("client_id", client.id)
      .in("id", deleteIds);

    if (delErr) {
      console.error("[SETTINGS] saveFaqsAction delete error", delErr);
      return;
    }
  }

  const upsertRows = ids
    .map((id, i) => {
      if (del[i]) return null;
      const question = questions[i];
      const answer = answers[i];
      if (!question || !answer) return null;

      const row: any = {
        client_id: client.id,
        question,
        answer,
        active: active[i] ?? true,
      };
      if (id) row.id = id;
      return row;
    })
    .filter(Boolean) as any[];

  if (upsertRows.length > 0) {
    const { error: upsertErr } = await supabase.from("client_faqs").upsert(upsertRows);
    if (upsertErr) {
      console.error("[SETTINGS] saveFaqsAction upsert error", upsertErr);
      return;
    }
  }

  revalidatePath("/dashboard/settings");
}

// --- Server-Action: AI an/aus schalten ---
export async function toggleAIAction() {
  "use server";

  const supabase = await createServerClientTyped();
  const userId = await getCurrentUserId(supabase);
  if (!userId) redirect("/login");

  const { data: client, error } = await supabase
    .from("clients")
    .select("id, ai_enabled")
    .eq("owner_user", userId)
    .maybeSingle();

  if (error || !client) {
    console.error("[SETTINGS] toggleAIAction get client error", error);
    return;
  }

  const { error: updErr } = await supabase
    .from("clients")
    .update({ ai_enabled: !client.ai_enabled })
    .eq("id", client.id);

  if (updErr) {
    console.error("[SETTINGS] toggleAIAction update error", updErr);
    return;
  }

  revalidatePath("/dashboard/settings");
}

// --- Server-Action: Staff-Logik an/aus schalten ---
export async function toggleStaffAction() {
  "use server";

  const supabase = await createServerClientTyped();
  const userId = await getCurrentUserId(supabase);
  if (!userId) redirect("/login");

  const { data: client, error } = await supabase
    .from("clients")
    .select("id, staff_enabled")
    .eq("owner_user", userId)
    .maybeSingle();

  if (error || !client) {
    console.error("[SETTINGS] toggleStaffAction get client error", error);
    return;
  }

  const { error: updErr } = await supabase
    .from("clients")
    .update({ staff_enabled: !client.staff_enabled })
    .eq("id", client.id);

  if (updErr) {
    console.error("[SETTINGS] toggleStaffAction update error", updErr);
    return;
  }

  revalidatePath("/dashboard/settings");
}

// ---------- page ----------
export default async function SettingsPage() {
  const supabase = await createServerClientTyped();
  const client = await getClientStrict();

  const aiEnabled = !!client.ai_enabled;
  const staffEnabled = !!client.staff_enabled;

  const [{ data: businessHours }, { data: services }, { data: faqs }] =
    await Promise.all([
      supabase
        .from("business_hours")
        .select("*")
        .eq("client_id", client.id)
        .order("weekday", { ascending: true }),
      supabase
        .from("services")
        .select("*")
        .eq("client_id", client.id)
        .order("title", { ascending: true }),
      supabase
        .from("client_faqs")
        .select("*")
        .eq("client_id", client.id)
        .order("created_at", { ascending: true }),
    ]);

  const bhMap = new Map<number, BusinessHourRow>();
  (businessHours ?? []).forEach((r: any) => bhMap.set(r.weekday, r as BusinessHourRow));

  const serviceRows = (services ?? []) as any as ServiceRow[];
  const faqRows = (faqs ?? []) as any as FaqRow[];

  const twilioNumber = client.twilio_number ?? null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-[#1E293B]">Settings</h1>
        <p className="mt-1 text-sm text-[#64748B]">
          Konfiguriere deine ReceptaAI-Einstellungen.
        </p>
      </div>

      {/* Firmenprofil */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#3B82F6]">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-[#1E293B]">Firmenprofil</h2>
            <p className="text-xs text-[#64748B]">
              Basisinformationen deines Unternehmens.
            </p>
          </div>
        </div>

        <form action={saveCompanyProfileAction} className="grid gap-6 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
              Firmenname
            </span>
            <input
              name="name"
              defaultValue={client.name ?? ""}
              placeholder="z.B. Zahnarztpraxis Dr. Müller"
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2 text-sm text-[#1E293B] outline-none focus:bg-white focus:ring-2 focus:ring-[#3B82F6]/20"
            />
          </label>

          {/* ✅ Twilio Nummer anzeigen (read-only) */}
          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
              Twilio Nummer
            </span>
            <input
              value={twilioNumber ?? "Noch nicht vergeben"}
              disabled
              className="w-full cursor-not-allowed rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2 text-sm text-[#1E293B] opacity-80"
            />
            <p className="text-[11px] text-[#64748B]">
              Diese Nummer ist die Hotline, über die Kunden anrufen.
            </p>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
              Öffentliche Telefonnummer (optional)
            </span>
            <input
              name="phone"
              defaultValue={client.phone ?? ""}
              placeholder="+49 30 12345678"
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2 text-sm text-[#1E293B] outline-none focus:bg-white focus:ring-2 focus:ring-[#3B82F6]/20"
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
              Branche
            </span>
            <input
              name="industry"
              defaultValue={client.industry ?? ""}
              placeholder="z.B. Friseur, Zahnarzt, Autohaus"
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2 text-sm text-[#1E293B] outline-none focus:bg-white focus:ring-2 focus:ring-[#3B82F6]/20"
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
              Öffentliche E-Mail (optional)
            </span>
            <input
              name="email"
              defaultValue={client.email ?? ""}
              placeholder="info@firma.de"
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2 text-sm text-[#1E293B] outline-none focus:bg-white focus:ring-2 focus:ring-[#3B82F6]/20"
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
              Notification E-Mail (Handoffs)
            </span>
            <input
              name="notification_email"
              defaultValue={client.notification_email ?? ""}
              placeholder="support@firma.de"
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2 text-sm text-[#1E293B] outline-none focus:bg-white focus:ring-2 focus:ring-[#3B82F6]/20"
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
              Zeitzone
            </span>
            <input
              name="timezone"
              defaultValue={client.timezone ?? "Europe/Berlin"}
              placeholder="Europe/Berlin"
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2 text-sm text-[#1E293B] outline-none focus:bg-white focus:ring-2 focus:ring-[#3B82F6]/20"
            />
          </label>

          <div className="md:col-span-2 flex items-center justify-end gap-3 pt-2">
            <button
              type="reset"
              className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-xs font-medium text-[#64748B]"
            >
              Änderungen verwerfen
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#10B981] px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-[#059669]"
            >
              Einstellungen speichern
            </button>
          </div>
        </form>
      </section>

      {/* Google Integration (identisch wie Onboarding) */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#3B82F6]">
            <PlugZap className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-[#1E293B]">Integrationen</h2>
            <p className="text-xs text-[#64748B]">
              Verbinde deinen Kalender, damit Termine & Blockzeiten berücksichtigt werden.
            </p>
          </div>
        </div>

        {/* ✅ Client Component */}
        <GoogleCalendarConnect />
      </section>

      {/* Öffnungszeiten (DB-bound) */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#10B981]">
            <Clock className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-[#1E293B]">Öffnungszeiten</h2>
            <p className="text-xs text-[#64748B]">
              Wird für Terminfindung genutzt.
            </p>
          </div>
        </div>

        <form action={saveBusinessHoursAction} className="space-y-3">
          {WEEKDAYS.map(({ label, weekday }) => {
            const row = bhMap.get(weekday);
            const isClosed = !!row?.is_closed;

            const open = row ? minutesToTime(row.open_min) : "09:00";
            const close = row ? minutesToTime(row.close_min) : "17:00";

            return (
              <div
                key={weekday}
                className="grid items-center gap-3 rounded-xl bg-[#F8FAFC] px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
              >
                <input type="hidden" name="bh_weekday" value={weekday} />

                <div className="text-sm font-medium text-[#1E293B]">{label}</div>

                <input
                  name="bh_open"
                  type="time"
                  defaultValue={open}
                  disabled={isClosed}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
                />

                <input
                  name="bh_close"
                  type="time"
                  defaultValue={close}
                  disabled={isClosed}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
                />

                <label className="inline-flex items-center gap-2 text-xs text-[#64748B]">
                  {/* checkbox -> wir schicken zusätzlich hidden, damit immer ein Wert kommt */}
                  <input type="hidden" name="bh_closed" value={isClosed ? "1" : "0"} />
                  <input
                    type="checkbox"
                    defaultChecked={isClosed}
                    onChange={(e) => {
                      // nur damit Browser UI passt – Server bekommt den hidden default.
                      // MVP: ohne JS kann hidden nicht updated werden, aber:
                      // => wir lösen das MVP-clean: wenn du togglen willst, mach’s später client-side.
                    }}
                    disabled
                    className="h-4 w-4 rounded border-slate-300 text-[#3B82F6]"
                    title="MVP: Closed Toggle kommt als Mini-Client später (wenn du willst)"
                  />
                  Geschlossen (MVP: toggle später)
                </label>
              </div>
            );
          })}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="rounded-lg bg-[#10B981] px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-[#059669]"
            >
              Öffnungszeiten speichern
            </button>
          </div>

          <p className="text-[11px] text-[#64748B]">
            Hinweis: Für MVP speichern wir Zeiten. “Geschlossen” Toggle können wir als Mini-Client-Komponente nachziehen.
          </p>
        </form>
      </section>

      {/* Services (DB-bound) */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#3B82F6]">
            <ShoppingBag className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-[#1E293B]">Services</h2>
            <p className="text-xs text-[#64748B]">
              Leistungen, die buchbar sind.
            </p>
          </div>
        </div>

        <form action={saveServicesAction} className="space-y-3">
          {serviceRows.map((s) => (
            <div
              key={s.id}
              className="grid gap-3 rounded-xl bg-[#F8FAFC] px-4 py-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
            >
              <input type="hidden" name="svc_id" value={s.id} />
              <input
                name="svc_title"
                defaultValue={s.title ?? ""}
                placeholder="Service"
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none"
              />
              <input
                name="svc_duration"
                type="number"
                min={10}
                step={5}
                defaultValue={s.duration_min ?? 30}
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none"
              />
              <input
                name="svc_price"
                type="number"
                min={0}
                step={1}
                defaultValue={s.price_cents != null ? String(Math.round(s.price_cents / 100)) : ""}
                placeholder="Preis (€)"
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none"
              />

              <div className="flex items-center justify-end gap-3">
                <input type="hidden" name="svc_active" value={(s.active ?? true) ? "1" : "0"} />
                <span className="text-xs text-[#64748B]">
                  Aktiv: {(s.active ?? true) ? "Ja" : "Nein"} (MVP Toggle später)
                </span>
                <label className="inline-flex items-center gap-2 text-xs text-[#64748B]">
                  <input type="hidden" name="svc_delete" value="0" />
                  <input
                    type="checkbox"
                    onChange={() => {}}
                    disabled
                    className="h-4 w-4 rounded border-slate-300"
                    title="MVP: Delete Toggle später (oder wir machen es direkt als Client-Komponente)"
                  />
                  Löschen (MVP später)
                </label>
              </div>
            </div>
          ))}

          {/* 1x Add Row (MVP ohne JS) */}
          <div className="grid gap-3 rounded-xl border border-dashed border-[#E2E8F0] bg-white px-4 py-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <input type="hidden" name="svc_id" value="" />
            <input
              name="svc_title"
              placeholder="Neuer Service (optional)"
              className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm outline-none"
            />
            <input
              name="svc_duration"
              type="number"
              min={10}
              step={5}
              defaultValue={30}
              className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm outline-none"
            />
            <input
              name="svc_price"
              type="number"
              min={0}
              step={1}
              placeholder="Preis (€)"
              className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm outline-none"
            />
            <div className="flex items-center justify-end gap-3">
              <input type="hidden" name="svc_active" value="1" />
              <input type="hidden" name="svc_delete" value="0" />
              <span className="text-xs text-[#64748B]">Wird beim Speichern erstellt</span>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="rounded-lg bg-[#10B981] px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-[#059669]"
            >
              Services speichern
            </button>
          </div>
        </form>
      </section>

      {/* FAQ (DB-bound) */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-500">
            <MessageCircle className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-[#1E293B]">FAQ-Bausteine</h2>
            <p className="text-xs text-[#64748B]">
              Antworten, die die AI direkt nutzen kann.
            </p>
          </div>
        </div>

        <form action={saveFaqsAction} className="space-y-3">
          {faqRows.map((f) => (
            <div key={f.id} className="space-y-2 rounded-xl bg-[#F8FAFC] p-4">
              <input type="hidden" name="faq_id" value={f.id} />
              <input
                name="faq_q"
                defaultValue={f.question ?? ""}
                placeholder="Frage"
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none"
              />
              <textarea
                name="faq_a"
                defaultValue={f.answer ?? ""}
                placeholder="Antwort"
                rows={2}
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none"
              />

              <div className="flex items-center justify-end gap-3">
                <input type="hidden" name="faq_active" value={(f.active ?? true) ? "1" : "0"} />
                <input type="hidden" name="faq_delete" value="0" />
                <span className="text-xs text-[#64748B]">
                  Aktiv: {(f.active ?? true) ? "Ja" : "Nein"} (MVP Toggle später)
                </span>
              </div>
            </div>
          ))}

          {/* 1x Add Row */}
          <div className="space-y-2 rounded-xl border border-dashed border-[#E2E8F0] bg-white p-4">
            <input type="hidden" name="faq_id" value="" />
            <input
              name="faq_q"
              placeholder="Neue Frage (optional)"
              className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm outline-none"
            />
            <textarea
              name="faq_a"
              placeholder="Neue Antwort (optional)"
              rows={2}
              className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm outline-none"
            />
            <input type="hidden" name="faq_active" value="1" />
            <input type="hidden" name="faq_delete" value="0" />
            <p className="text-[11px] text-[#64748B]">
              Wird beim Speichern erstellt, wenn Frage + Antwort ausgefüllt sind.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="rounded-lg bg-[#10B981] px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-[#059669]"
            >
              FAQs speichern
            </button>
          </div>
        </form>
      </section>

      {/* AI & Stimme */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#3B82F6]">
              <Brain className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-[#1E293B]">AI-Einstellungen</h2>
              <p className="text-xs text-[#64748B]">Steuere, ob ReceptaAI aktiv antwortet.</p>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <form action={toggleAIAction}>
              <div className="flex items-center justify-between rounded-xl bg-[#F8FAFC] px-4 py-3">
                <div>
                  <p className="font-medium text-[#1E293B]">AI aktivieren</p>
                  <p className="text-xs text-[#64748B]">
                    Wenn deaktiviert, werden Anrufe nicht automatisch beantwortet.
                  </p>
                </div>
                <button
                  type="submit"
                  className={[
                    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition",
                    aiEnabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "mr-2 inline-block h-2 w-2 rounded-full",
                      aiEnabled ? "bg-emerald-500" : "bg-slate-400",
                    ].join(" ")}
                  />
                  {aiEnabled ? "Aktiviert" : "Deaktiviert"}
                </button>
              </div>
            </form>

            <form action={toggleStaffAction}>
              <div className="flex items-center justify-between rounded-xl bg-[#F8FAFC] px-4 py-3">
                <div>
                  <p className="font-medium text-[#1E293B]">Mitarbeiterwünsche</p>
                  <p className="text-xs text-[#64748B]">
                    Wenn deaktiviert, werden Termine ohne Mitarbeiter-Zuordnung geplant.
                  </p>
                </div>
                <button
                  type="submit"
                  className={[
                    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition",
                    staffEnabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "mr-2 inline-block h-2 w-2 rounded-full",
                      staffEnabled ? "bg-emerald-500" : "bg-slate-400",
                    ].join(" ")}
                  />
                  {staffEnabled ? "Aktiviert" : "Deaktiviert"}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-500">
              <Mic className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-[#1E293B]">Stimme wählen</h2>
              <p className="text-xs text-[#64748B]">
                (Demo) Stimme &amp; Speed später.
              </p>
            </div>
          </div>

          <div className="space-y-4 text-sm text-[#1E293B] opacity-90">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
                KI-Stimme
              </p>
              <p className="rounded-xl bg-[#F8FAFC] px-4 py-2 text-sm">
                Standard-Stimme (Demo)
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
                Sprechgeschwindigkeit
              </p>
              <div className="mt-1 h-1 rounded-full bg-[#E2E8F0]">
                <div className="h-1 w-2/3 rounded-full bg-[#3B82F6]" />
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-[#64748B]">
                <span>Langsam</span>
                <span>Schnell</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Abo & Support */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#3B82F6]">
            <LifeBuoy className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-[#1E293B]">Abo &amp; Support</h2>
            <p className="text-xs text-[#64748B]">
              Verwalte dein Abonnement und kontaktiere den Support.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 text-sm text-[#1E293B] md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-[#64748B]">
            Du möchtest dein ReceptaAI-Abo kündigen oder anpassen? Schreib uns einfach eine kurze Nachricht.
          </p>
          <a
            href="mailto:support@receptaai.app?subject=Abo%20kündigen%20oder%20anpassen"
            className="inline-flex items-center justify-center rounded-lg bg-[#3B82F6] px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-[#2563EB]"
          >
            Support kontaktieren
          </a>
        </div>
      </section>
    </div>
  );
}
