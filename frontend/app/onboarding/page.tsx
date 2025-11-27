// frontend/app/onboarding/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import GoogleCalendarConnect from "./GoogleCalendarConnect";

type ClientForm = {
  name: string;
  phone: string;
  email: string;
  notification_email: string;
  timezone: string;
  industry: string;
};

type HourForm = {
  weekday: number; // 0–6
  open: string; // "09:00"
  close: string; // "18:00"
  closed: boolean;
};

type ServiceForm = {
  name: string;
  durationMin: number;
  price: number;
  active: boolean;
};

type StaffForm = {
  name: string;
  calendarId: string;
  isDefault: boolean;
  active: boolean;
};

type FaqForm = {
  question: string;
  answer: string;
  active: boolean;
};

const WEEKDAYS = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
];

const INDUSTRIES = [
  "Friseur / Salon",
  "Kosmetik / Beauty",
  "Arztpraxis",
  "Zahnarzt",
  "Physiotherapie",
  "Coaching / Beratung",
  "Auto-Werkstatt",
  "Fitnessstudio",
  "Restaurant / Café",
  "Sonstige Dienstleistung",
];

// Hilfsfunktion: "HH:MM" -> Minuten
function timeToMinutes(t: string): number | null {
  if (!t) return null;
  const [hh, mm] = t.split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
}

export default function OnboardingPage() {
  const router = useRouter();

  // --- State ---

  const [client, setClient] = useState<ClientForm>({
    name: "",
    phone: "",
    email: "",
    notification_email: "",
    timezone: "Europe/Berlin",
    industry: "",
  });

  const [hours, setHours] = useState<HourForm[]>(
    Array.from({ length: 7 }, (_, i) => ({
      weekday: i,
      open: "09:00",
      close: "18:00",
      closed: i === 0, // Sonntag zu
    }))
  );

  const [services, setServices] = useState<ServiceForm[]>([
    { name: "Haarschnitt", durationMin: 30, price: 30, active: true },
  ]);

  const [staff, setStaff] = useState<StaffForm[]>([
    { name: "", calendarId: "", isDefault: true, active: true },
  ]);

  const [faqs, setFaqs] = useState<FaqForm[]>([
    {
      question: "Wie lange dauert ein Haarschnitt?",
      answer: "In der Regel etwa 30 Minuten.",
      active: true,
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // --- Submit ---

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const payload = {
      client: {
        ...client,
        industry: client.industry.trim(),
      },
      hours: hours.map((h) => ({
        weekday: h.weekday,
        open_min: h.closed ? null : timeToMinutes(h.open),
        close_min: h.closed ? null : timeToMinutes(h.close),
        closed: h.closed,
      })),
      services: services
        .filter((s) => s.name.trim())
        .map((s) => ({
          name: s.name.trim(),
          duration_min: s.durationMin,
          price_cents: Math.round(s.price * 100),
          active: s.active,
        })),
      staff: staff
        .filter((st) => st.name.trim())
        .map((st) => ({
          name: st.name.trim(),
          calendar_id: st.calendarId || null,
          is_default: st.isDefault,
          active: st.active,
        })),
      faqs: faqs
        .filter((f) => f.question.trim())
        .map((f) => ({
          question: f.question.trim(),
          answer: f.answer.trim(),
          active: f.active,
        })),
    };

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error ?? "Fehler beim Speichern.");
        return;
      }

      setSuccess(true);

      // Optional: AI-Training anstoßen (Fehler hier ignorieren)
      try {
        await fetch("/api/ai/train", { method: "POST" });
      } catch (err) {
        console.error("AI train failed (ignored)", err);
      }

      router.push("/dashboard");
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ?? "Unbekannter Fehler beim Speichern. Bitte später erneut versuchen."
      );
    } finally {
      setLoading(false);
    }
  }

  // --- Helper für Änderungen ---

  function updateHour(
    index: number,
    patch: Partial<HourForm>
  ) {
    setHours((prev) =>
      prev.map((h, i) => (i === index ? { ...h, ...patch } : h))
    );
  }

  function updateService(index: number, patch: Partial<ServiceForm>) {
    setServices((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s))
    );
  }

  function updateStaff(index: number, patch: Partial<StaffForm>) {
    setStaff((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s))
    );
  }

  function updateFaq(index: number, patch: Partial<FaqForm>) {
    setFaqs((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f))
    );
  }

  // --- UI ---

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-10">
      <div className="mx-auto w-full max-w-5xl">
        {/* Header */}
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Onboarding
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Willkommen bei ReceptaAI
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Trage hier einmalig deine Firmendaten ein. Die AI nutzt diese Infos
            für Terminbuchungen, Öffnungszeiten, FAQs und Weiterleitungen.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          {/* Firmendaten */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Firmendaten
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Basisinformationen, die in der Begrüßung und bei Terminbestätigungen
              verwendet werden.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-slate-700">
                  Name / Salon
                </label>
                <input
                  type="text"
                  value={client.name}
                  onChange={(e) =>
                    setClient((c) => ({ ...c, name: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none ring-0 focus:border-[#3B82F6]"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700">
                  Telefon
                </label>
                <input
                  type="tel"
                  value={client.phone}
                  onChange={(e) =>
                    setClient((c) => ({ ...c, phone: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none ring-0 focus:border-[#3B82F6]"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700">
                  E-Mail (öffentlich)
                </label>
                <input
                  type="email"
                  value={client.email}
                  onChange={(e) =>
                    setClient((c) => ({ ...c, email: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none ring-0 focus:border-[#3B82F6]"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700">
                  Notification-E-Mail (Handoffs)
                </label>
                <input
                  type="email"
                  value={client.notification_email}
                  onChange={(e) =>
                    setClient((c) => ({
                      ...c,
                      notification_email: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none ring-0 focus:border-[#3B82F6]"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700">
                  Branche
                </label>
                <select
                  value={client.industry}
                  onChange={(e) =>
                    setClient((c) => ({ ...c, industry: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none ring-0 focus:border-[#3B82F6]"
                  required
                >
                  <option value="">Bitte Branche auswählen</option>
                  {INDUSTRIES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700">
                  Zeitzone
                </label>
                <input
                  type="text"
                  value={client.timezone}
                  onChange={(e) =>
                    setClient((c) => ({ ...c, timezone: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none ring-0 focus:border-[#3B82F6]"
                />
              </div>
            </div>
          </section>

          {/* Google Kalender */}
          <GoogleCalendarConnect />

          {/* Öffnungszeiten */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Öffnungszeiten
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Diese Zeiten nutzt die AI, um verfügbare Termine zu finden.
            </p>

            <div className="mt-4 space-y-3">
              {hours.map((h, idx) => (
                <div
                  key={h.weekday}
                  className="grid items-center gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_auto]"
                >
                  <span className="text-sm text-slate-600">
                    {WEEKDAYS[h.weekday]}
                  </span>

                  <input
                    type="time"
                    value={h.open}
                    disabled={h.closed}
                    onChange={(e) =>
                      updateHour(idx, { open: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[#3B82F6] disabled:cursor-not-allowed disabled:bg-slate-100"
                  />

                  <input
                    type="time"
                    value={h.close}
                    disabled={h.closed}
                    onChange={(e) =>
                      updateHour(idx, { close: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[#3B82F6] disabled:cursor-not-allowed disabled:bg-slate-100"
                  />

                  <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={h.closed}
                      onChange={(e) =>
                        updateHour(idx, { closed: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-slate-300 text-[#3B82F6] focus:ring-[#3B82F6]"
                    />
                    Geschlossen
                  </label>
                </div>
              ))}
            </div>
          </section>

          {/* Services */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Services
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Leistungen, die für Terminbuchungen zur Verfügung stehen.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setServices((prev) => [
                    ...prev,
                    { name: "", durationMin: 30, price: 0, active: true },
                  ])
                }
                className="text-sm font-medium text-[#3B82F6] hover:underline"
              >
                + Service hinzufügen
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {services.map((s, idx) => (
                <div
                  key={idx}
                  className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
                >
                  <input
                    type="text"
                    placeholder="z.B. Beratung"
                    value={s.name}
                    onChange={(e) =>
                      updateService(idx, { name: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[#3B82F6]"
                  />
                  <input
                    type="number"
                    min={5}
                    step={5}
                    placeholder="Dauer (Min.)"
                    value={s.durationMin}
                    onChange={(e) =>
                      updateService(idx, {
                        durationMin: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[#3B82F6]"
                  />
                  <input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="Preis (€)"
                    value={s.price}
                    onChange={(e) =>
                      updateService(idx, {
                        price: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[#3B82F6]"
                  />

                  <div className="flex items-center justify-end gap-3">
                    <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={s.active}
                        onChange={(e) =>
                          updateService(idx, { active: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-slate-300 text-[#3B82F6] focus:ring-[#3B82F6]"
                      />
                      Aktiv
                    </label>
                    {services.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setServices((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                        }
                        className="text-xs text-slate-400 hover:text-rose-500"
                      >
                        Entfernen
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Mitarbeiter */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Mitarbeiter & Kalender
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Ordne interne Kalender einzelnen Mitarbeitenden zu.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setStaff((prev) => [
                    ...prev,
                    {
                      name: "",
                      calendarId: "",
                      isDefault: false,
                      active: true,
                    },
                  ])
                }
                className="text-sm font-medium text-[#3B82F6] hover:underline"
              >
                + Mitarbeiter hinzufügen
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {staff.map((s, idx) => (
                <div
                  key={idx}
                  className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_auto]"
                >
                  <input
                    type="text"
                    placeholder="Name"
                    value={s.name}
                    onChange={(e) =>
                      updateStaff(idx, { name: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[#3B82F6]"
                  />
                  <input
                    type="text"
                    placeholder="Google Kalender ID (optional)"
                    value={s.calendarId}
                    onChange={(e) =>
                      updateStaff(idx, { calendarId: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[#3B82F6]"
                  />

                  <div className="flex items-center justify-end gap-3">
                    <label className="inline-flex items-center gap-1 text-xs text-slate-600">
                      <input
                        type="radio"
                        name="defaultStaff"
                        checked={s.isDefault}
                        onChange={() =>
                          setStaff((prev) =>
                            prev.map((st, i) => ({
                              ...st,
                              isDefault: i === idx,
                            }))
                          )
                        }
                        className="h-4 w-4 border-slate-300 text-[#3B82F6] focus:ring-[#3B82F6]"
                      />
                      Standard
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={s.active}
                        onChange={(e) =>
                          updateStaff(idx, { active: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-slate-300 text-[#3B82F6] focus:ring-[#3B82F6]"
                      />
                      Aktiv
                    </label>
                    {staff.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setStaff((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                        }
                        className="text-xs text-slate-400 hover:text-rose-500"
                      >
                        Entfernen
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* FAQs */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  FAQ-Bausteine
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Häufige Fragen, die die AI direkt beantworten kann.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setFaqs((prev) => [
                    ...prev,
                    { question: "", answer: "", active: true },
                  ])
                }
                className="text-sm font-medium text-[#3B82F6] hover:underline"
              >
                + Frage hinzufügen
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {faqs.map((f, idx) => (
                <div
                  key={idx}
                  className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/60 p-4"
                >
                  <input
                    type="text"
                    placeholder="Frage"
                    value={f.question}
                    onChange={(e) =>
                      updateFaq(idx, { question: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#3B82F6]"
                  />
                  <textarea
                    placeholder="Antwort"
                    value={f.answer}
                    onChange={(e) =>
                      updateFaq(idx, { answer: e.target.value })
                    }
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#3B82F6]"
                  />
                  <div className="flex items-center justify-between">
                    <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={f.active}
                        onChange={(e) =>
                          updateFaq(idx, { active: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-slate-300 text-[#3B82F6] focus:ring-[#3B82F6]"
                      />
                      Aktiv
                    </label>
                    {faqs.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setFaqs((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                        }
                        className="text-xs text-slate-400 hover:text-rose-500"
                      >
                        Entfernen
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Footer / Actions */}
          <div className="sticky bottom-0 mt-4 bg-gradient-to-t from-[#F8FAFC] pt-4">
            {error && (
              <div className="mb-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Einstellungen gespeichert. Du wirst zum Dashboard weitergeleitet…
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Später ausfüllen
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center rounded-lg bg-[#3B82F6] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Speichern…" : "Onboarding abschließen"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
