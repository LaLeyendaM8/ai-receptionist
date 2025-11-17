// app/onboarding/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ClientForm = {
  name: string;
  phone: string;
  email: string;
  notification_email: string;
  timezone: string;
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
  price: number; // Euro
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

function timeToMinutes(t: string): number | null {
  if (!t) return null;
  const [hh, mm] = t.split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
}

export default function OnboardingPage() {
  const router = useRouter();

  const [client, setClient] = useState<ClientForm>({
    name: "",
    phone: "",
    email: "",
    notification_email: "",
    timezone: "Europe/Berlin",
  });

  const [hours, setHours] = useState<HourForm[]>(
    Array.from({ length: 7 }).map((_, i) => ({
      weekday: i,
      open: "09:00",
      close: "18:00",
      closed: i === 0, // Sonntag zu
    })),
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const payload = {
      client,
      hours: hours.map((h) => ({
        weekday: h.weekday,
        open_min: h.closed ? null : timeToMinutes(h.open),
        close_min: h.closed ? null : timeToMinutes(h.close),
        is_closed: h.closed,
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

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Fehler beim Speichern.");
      } else {
        setSuccess(true);
        // nach Onboarding ins Admin-Dashboard
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err?.message || "Unbekannter Fehler beim Speichern.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">Onboarding</h1>
      <p className="mb-8 text-sm text-gray-400">
        Trage hier einmalig deine Firmendaten ein. Die AI nutzt diese Infos für
        Termine, FAQs und Weiterleitungen.
      </p>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Firmendaten */}
        <section className="space-y-4 rounded-lg border border-gray-700 bg-gray-900/40 p-4">
          <h2 className="text-xl font-semibold">Firmendaten</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm">Name / Salon</label>
              <input
                className="w-full rounded border border-gray-700 bg-black/40 px-3 py-2 text-sm"
                value={client.name}
                onChange={(e) =>
                  setClient((c) => ({ ...c, name: e.target.value }))
                }
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm">Telefon</label>
              <input
                className="w-full rounded border border-gray-700 bg-black/40 px-3 py-2 text-sm"
                value={client.phone}
                onChange={(e) =>
                  setClient((c) => ({ ...c, phone: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-sm">E-Mail (öffentlich)</label>
              <input
                type="email"
                className="w-full rounded border border-gray-700 bg-black/40 px-3 py-2 text-sm"
                value={client.email}
                onChange={(e) =>
                  setClient((c) => ({ ...c, email: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-sm">
                Notification-E-Mail (Handoffs)
              </label>
              <input
                type="email"
                className="w-full rounded border border-gray-700 bg-black/40 px-3 py-2 text-sm"
                value={client.notification_email}
                onChange={(e) =>
                  setClient((c) => ({
                    ...c,
                    notification_email: e.target.value,
                  }))
                }
              />
            </div>
          </div>
        </section>

        {/* Öffnungszeiten */}
        <section className="space-y-4 rounded-lg border border-gray-700 bg-gray-900/40 p-4">
          <h2 className="text-xl font-semibold">Öffnungszeiten</h2>
          <div className="space-y-2">
            {hours.map((h, idx) => (
              <div
                key={h.weekday}
                className="grid items-center gap-3 md:grid-cols-[120px,120px,120px,auto]"
              >
                <span className="text-sm">{WEEKDAYS[h.weekday]}</span>
                <input
                  type="time"
                  disabled={h.closed}
                  className="rounded border border-gray-700 bg-black/40 px-2 py-1 text-sm"
                  value={h.open}
                  onChange={(e) =>
                    setHours((rows) => {
                      const copy = [...rows];
                      copy[idx] = { ...copy[idx], open: e.target.value };
                      return copy;
                    })
                  }
                />
                <input
                  type="time"
                  disabled={h.closed}
                  className="rounded border border-gray-700 bg-black/40 px-2 py-1 text-sm"
                  value={h.close}
                  onChange={(e) =>
                    setHours((rows) => {
                      const copy = [...rows];
                      copy[idx] = { ...copy[idx], close: e.target.value };
                      return copy;
                    })
                  }
                />
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={h.closed}
                    onChange={(e) =>
                      setHours((rows) => {
                        const copy = [...rows];
                        copy[idx] = { ...copy[idx], closed: e.target.checked };
                        return copy;
                      })
                    }
                  />
                  geschlossen
                </label>
              </div>
            ))}
          </div>
        </section>

        {/* Services */}
        <section className="space-y-4 rounded-lg border border-gray-700 bg-gray-900/40 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Leistungen</h2>
            <button
              type="button"
              className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold"
              onClick={() =>
                setServices((rows) => [
                  ...rows,
                  { name: "", durationMin: 30, price: 30, active: true },
                ])
              }
            >
              + Leistung
            </button>
          </div>
          <div className="space-y-3">
            {services.map((s, idx) => (
              <div
                key={idx}
                className="grid gap-3 md:grid-cols-[2fr,1fr,1fr,auto]"
              >
                <input
                  placeholder="Name (z.B. Haarschnitt)"
                  className="rounded border border-gray-700 bg-black/40 px-2 py-1 text-sm"
                  value={s.name}
                  onChange={(e) =>
                    setServices((rows) => {
                      const copy = [...rows];
                      copy[idx] = { ...copy[idx], name: e.target.value };
                      return copy;
                    })
                  }
                />
                <input
                  type="number"
                  min={5}
                  className="rounded border border-gray-700 bg-black/40 px-2 py-1 text-sm"
                  value={s.durationMin}
                  onChange={(e) =>
                    setServices((rows) => {
                      const copy = [...rows];
                      copy[idx] = {
                        ...copy[idx],
                        durationMin: Number(e.target.value),
                      };
                      return copy;
                    })
                  }
                />
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  className="rounded border border-gray-700 bg-black/40 px-2 py-1 text-sm"
                  value={s.price}
                  onChange={(e) =>
                    setServices((rows) => {
                      const copy = [...rows];
                      copy[idx] = { ...copy[idx], price: Number(e.target.value) };
                      return copy;
                    })
                  }
                />
                <button
                  type="button"
                  className="text-xs text-red-400"
                  onClick={() =>
                    setServices((rows) => rows.filter((_, i) => i !== idx))
                  }
                >
                  Entfernen
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Staff */}
        <section className="space-y-4 rounded-lg border border-gray-700 bg-gray-900/40 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Mitarbeiter</h2>
            <button
              type="button"
              className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold"
              onClick={() =>
                setStaff((rows) => [
                  ...rows,
                  {
                    name: "",
                    calendarId: "",
                    isDefault: false,
                    active: true,
                  },
                ])
              }
            >
              + Mitarbeiter
            </button>
          </div>
          <p className="text-xs text-gray-400">
            Für MVP reicht ein Kalender. Wenn du mehrere Mitarbeiter hast, trage
            sie hier ein – die AI kann später gezielt bei einzelnen buchen.
          </p>
          <div className="space-y-3">
            {staff.map((st, idx) => (
              <div
                key={idx}
                className="grid gap-3 md:grid-cols-[2fr,2fr,auto,auto]"
              >
                <input
                  placeholder="Name (z.B. Ali)"
                  className="rounded border border-gray-700 bg-black/40 px-2 py-1 text-sm"
                  value={st.name}
                  onChange={(e) =>
                    setStaff((rows) => {
                      const copy = [...rows];
                      copy[idx] = { ...copy[idx], name: e.target.value };
                      return copy;
                    })
                  }
                />
                <input
                  placeholder="Google-Kalender-ID (optional)"
                  className="rounded border border-gray-700 bg-black/40 px-2 py-1 text-sm"
                  value={st.calendarId}
                  onChange={(e) =>
                    setStaff((rows) => {
                      const copy = [...rows];
                      copy[idx] = { ...copy[idx], calendarId: e.target.value };
                      return copy;
                    })
                  }
                />
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={st.isDefault}
                    onChange={(e) =>
                      setStaff((rows) =>
                        rows.map((row, i) => ({
                          ...row,
                          isDefault: i === idx ? e.target.checked : false,
                        })),
                      )
                    }
                  />
                  Standard
                </label>
                <button
                  type="button"
                  className="text-xs text-red-400"
                  onClick={() =>
                    setStaff((rows) => rows.filter((_, i) => i !== idx))
                  }
                >
                  Entfernen
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* FAQs */}
        <section className="space-y-4 rounded-lg border border-gray-700 bg-gray-900/40 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">FAQs</h2>
            <button
              type="button"
              className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold"
              onClick={() =>
                setFaqs((rows) => [
                  ...rows,
                  { question: "", answer: "", active: true },
                ])
              }
            >
              + FAQ
            </button>
          </div>
          <div className="space-y-3">
            {faqs.map((f, idx) => (
              <div key={idx} className="space-y-2">
                <input
                  placeholder="Frage"
                  className="w-full rounded border border-gray-700 bg-black/40 px-2 py-1 text-sm"
                  value={f.question}
                  onChange={(e) =>
                    setFaqs((rows) => {
                      const copy = [...rows];
                      copy[idx] = { ...copy[idx], question: e.target.value };
                      return copy;
                    })
                  }
                />
                <textarea
                  placeholder="Antwort"
                  className="w-full rounded border border-gray-700 bg-black/40 px-2 py-1 text-sm"
                  rows={2}
                  value={f.answer}
                  onChange={(e) =>
                    setFaqs((rows) => {
                      const copy = [...rows];
                      copy[idx] = { ...copy[idx], answer: e.target.value };
                      return copy;
                    })
                  }
                />
                <button
                  type="button"
                  className="text-xs text-red-400"
                  onClick={() =>
                    setFaqs((rows) => rows.filter((_, i) => i !== idx))
                  }
                >
                  Entfernen
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        {error && (
          <p className="text-sm text-red-400">
            Fehler beim Speichern: {error}
          </p>
        )}
        {success && (
          <p className="text-sm text-emerald-400">
            Onboarding gespeichert. Du kannst jetzt im Admin-Dashboard
            weiterarbeiten.
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {loading ? "Speichert..." : "Onboarding speichern"}
        </button>
      </form>
    </div>
  );
}
