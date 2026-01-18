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

export const dynamic = "force-dynamic";

// --- Hilfsfunktion: Client des eingeloggten Users holen ---
async function getClient() {
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

  return client as any;
}

// --- Server-Action: Firmenprofil speichern ---
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

  const display_name = String(formData.get("display_name") ?? "").trim() || null;
  const phone_number = String(formData.get("phone_number") ?? "").trim() || null;
  const industry = String(formData.get("industry") ?? "").trim() || null;
  const greeting_text = String(formData.get("greeting_text") ?? "").trim() || null;

  const { error: updErr } = await supabase
    .from("clients")
    .update({
      display_name,
      phone_number,
      industry,
      greeting_text,
    })
    .eq("id", client.id);

  if (updErr) {
    console.error("[SETTINGS] saveCompanyProfileAction update error", updErr);
    return;
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

export default async function SettingsPage() {
  const client = await getClient();

  const aiEnabled: boolean = !!client?.ai_enabled;
  const staffEnabled: boolean = !!client?.staff_enabled;

  // Google connected heuristics (ohne harte Typ-Abhängigkeit)
  const isGoogleConnected = Boolean(
    client?.google_connected ||
      client?.google_calendar_connected ||
      client?.google_refresh_token ||
      client?.google_access_token
  );

  // Twilio-Nummer nur anzeigen, wenn du sie in clients speicherst (optional)
  const twilioNumber =
    client?.twilio_number || client?.twilio_phone || client?.twilio_from || null;

  // 👉 Passe diese Route an deine echte Google OAuth Start-Route an
  const googleConnectHref = "/api/google/connect";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-[#1E293B]">Settings</h1>
        <p className="mt-1 text-sm text-[#64748B]">
          Konfiguriere deine ReceptaAI-Einstellungen.
        </p>
      </div>

      {/* Firmenprofil (JETZT editierbar) */}
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
              name="display_name"
              defaultValue={client?.display_name ?? ""}
              placeholder="z.B. Zahnarztpraxis Dr. Müller"
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2 text-sm text-[#1E293B] outline-none focus:bg-white focus:ring-2 focus:ring-[#3B82F6]/20"
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
              Telefonnummer
            </span>
            <input
              name="phone_number"
              defaultValue={client?.phone_number ?? ""}
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
              defaultValue={client?.industry ?? ""}
              placeholder="z.B. Friseur, Zahnarzt, Autohaus"
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2 text-sm text-[#1E293B] outline-none focus:bg-white focus:ring-2 focus:ring-[#3B82F6]/20"
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
              Begrüßungstext
            </span>
            <textarea
              name="greeting_text"
              defaultValue={client?.greeting_text ?? ""}
              placeholder="Guten Tag, Sie sind verbunden mit ..."
              rows={3}
              className="w-full resize-none rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2 text-sm text-[#1E293B] outline-none focus:bg-white focus:ring-2 focus:ring-[#3B82F6]/20"
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

      {/* Öffnungszeiten (MVP: readonly – später DB) */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#10B981]">
            <Clock className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-[#1E293B]">Öffnungszeiten</h2>
            <p className="text-xs text-[#64748B]">
              (Demo) Logik kommt im nächsten Sprint.
            </p>
          </div>
        </div>

        <div className="space-y-3 text-sm text-[#1E293B] opacity-90">
          {["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"].map((day) => (
            <div
              key={day}
              className="flex items-center justify-between rounded-xl bg-[#F8FAFC] px-4 py-2"
            >
              <span>{day}</span>
              <div className="flex items-center gap-4 text-xs text-[#64748B]">
                <span>09:00 bis 17:00</span>
                <button
                  type="button"
                  disabled
                  className="relative inline-flex h-5 w-9 cursor-not-allowed items-center rounded-full bg-slate-200"
                  title="Coming soon"
                >
                  <span className="inline-block h-4 w-4 translate-x-[2px] rounded-full bg-white shadow" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Services (MVP: readonly – später DB) */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#3B82F6]">
              <ShoppingBag className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-[#1E293B]">Services</h2>
              <p className="text-xs text-[#64748B]">
                (Demo) Bearbeiten kommt später.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#3B82F6]/60"
            title="Coming soon"
          >
            Service hinzufügen
          </button>
        </div>

        <div className="space-y-2 text-sm text-[#1E293B]">
          {["Beratung", "Erstgespräch", "Follow-up", "Check-up"].map((service) => (
            <div
              key={service}
              className="flex items-center justify-between rounded-xl bg-[#F8FAFC] px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>{service}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-[#64748B]">
                <span>30 min</span>
                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed text-xs font-medium text-[#3B82F6]/60"
                  title="Coming soon"
                >
                  Bearbeiten
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ (MVP: readonly – später DB) */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-500">
              <MessageCircle className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-[#1E293B]">FAQ-Bausteine</h2>
              <p className="text-xs text-[#64748B]">(Demo) CRUD kommt später.</p>
            </div>
          </div>
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#3B82F6]/60"
            title="Coming soon"
          >
            Frage hinzufügen
          </button>
        </div>

        <div className="space-y-2 text-sm text-[#1E293B]">
          <div className="rounded-xl bg-[#F8FAFC] px-4 py-3">
            <p className="font-medium">Wie lauten Ihre Öffnungszeiten?</p>
            <p className="text-xs text-[#64748B]">Montag bis Freitag 9–17 Uhr</p>
          </div>
          <div className="rounded-xl bg-[#F8FAFC] px-4 py-3">
            <p className="font-medium">Wie kann ich einen Termin buchen?</p>
            <p className="text-xs text-[#64748B]">Über diese Hotline oder online.</p>
          </div>
          <div className="rounded-xl bg-[#F8FAFC] px-4 py-3">
            <p className="font-medium">Nehmen Sie neue Patienten an?</p>
            <p className="text-xs text-[#64748B]">Ja, wir nehmen neue Patienten an.</p>
          </div>
        </div>
      </section>

      {/* Integrationen (Google: echt “verbunden” anzeigen + Connect Link) */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#3B82F6]">
            <PlugZap className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-[#1E293B]">Integrationen</h2>
            <p className="text-xs text-[#64748B]">Verbinde deine Kalender und Tools.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div
            className={[
              "flex flex-col gap-3 rounded-2xl px-4 py-3",
              isGoogleConnected
                ? "border border-emerald-400 bg-emerald-50"
                : "border border-[#E2E8F0] bg-[#F8FAFC]",
            ].join(" ")}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-[#1E293B]">Google Calendar</div>
              <span
                className={[
                  "inline-flex h-2 w-2 rounded-full",
                  isGoogleConnected ? "bg-emerald-500" : "bg-slate-300",
                ].join(" ")}
              />
            </div>

            <a
              href={googleConnectHref}
              className={[
                "rounded-lg border bg-white px-3 py-1.5 text-center text-xs font-medium",
                isGoogleConnected
                  ? "border-emerald-400 text-emerald-600"
                  : "border-[#E2E8F0] text-[#3B82F6] hover:bg-[#EFF6FF]",
              ].join(" ")}
            >
              {isGoogleConnected ? "Verbunden" : "Verbinden"}
            </a>

            {twilioNumber && (
              <p className="text-xs text-[#64748B]">
                Twilio Nummer: <span className="text-[#1E293B]">{twilioNumber}</span>
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
            <div className="text-sm font-medium text-[#1E293B]">Weitere Integrationen</div>
            <p className="text-xs text-[#64748B]">
              Twilio &amp; weitere Tools folgen in einer späteren Version.
            </p>
          </div>
        </div>
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
