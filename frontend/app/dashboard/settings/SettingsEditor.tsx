"use client";

import { useMemo, useState } from "react";

type BusinessHourRow = {
  id?: string;
  client_id: string;
  weekday: number; // 0..6
  open_min: number;
  close_min: number;
  is_closed: boolean | null;
};

type ServiceRow = {
  id?: string;
  client_id: string;
  title: string;
  duration_min: number;
  price_cents: number | null;
  active: boolean | null;
};

type FaqRow = {
  id?: string;
  client_id: string;
  question: string;
  answer: string;
  active: boolean | null;
};

const WEEKDAYS: { label: string; weekday: number }[] = [
  { label: "Sonntag", weekday: 0 },
  { label: "Montag", weekday: 1 },
  { label: "Dienstag", weekday: 2 },
  { label: "Mittwoch", weekday: 3 },
  { label: "Donnerstag", weekday: 4 },
  { label: "Freitag", weekday: 5 },
  { label: "Samstag", weekday: 6 },
];

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

function centsToEuroStr(cents: number | null) {
  if (cents == null) return "";
  return String(Math.round(cents / 100));
}

function euroStrToCents(v: string) {
  const s = (v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

type Props = {
  initialBusinessHours: BusinessHourRow[];
  initialServices: ServiceRow[];
  initialFaqs: FaqRow[];

  saveBusinessHoursAction: (formData: FormData) => Promise<void>;
  saveServicesAction: (formData: FormData) => Promise<void>;
  saveFaqsAction: (formData: FormData) => Promise<void>;
};

type BHState = {
  weekday: number;
  open: string;
  close: string;
  closed: boolean;
};

type ServiceState = {
  id: string; // existing uuid or "new_x"
  title: string;
  duration_min: number;
  price_eur: string; // for input
  active: boolean;
  _delete: boolean;
};

type FaqState = {
  id: string; // existing uuid or "new_x"
  question: string;
  answer: string;
  active: boolean;
  _delete: boolean;
};

export default function SettingsEditor({
  initialBusinessHours,
  initialServices,
  initialFaqs,
  saveBusinessHoursAction,
  saveServicesAction,
  saveFaqsAction,
}: Props) {
  // ---------- Business Hours State ----------
  const initialBH: BHState[] = useMemo(() => {
    const map = new Map<number, BusinessHourRow>();
    (initialBusinessHours ?? []).forEach((r) => map.set(r.weekday, r));

    return WEEKDAYS.map(({ weekday }) => {
      const row = map.get(weekday);
      const closed = !!row?.is_closed;
      return {
        weekday,
        open: row ? minutesToTime(row.open_min) : "09:00",
        close: row ? minutesToTime(row.close_min) : "17:00",
        closed,
      };
    });
  }, [initialBusinessHours]);

  const [bh, setBh] = useState<BHState[]>(initialBH);

  function patchBH(idx: number, patch: Partial<BHState>) {
    setBh((prev) => prev.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  }

  // ---------- Services State ----------
  const [services, setServices] = useState<ServiceState[]>(
    (initialServices ?? []).map((s) => ({
      id: s.id ?? `new_${crypto.randomUUID()}`,
      title: s.title ?? "",
      duration_min: s.duration_min ?? 30,
      price_eur: centsToEuroStr(s.price_cents ?? null),
      active: s.active ?? true,
      _delete: false,
    }))
  );

  function addService() {
    setServices((prev) => [
      ...prev,
      {
        id: `new_${crypto.randomUUID()}`,
        title: "",
        duration_min: 30,
        price_eur: "",
        active: true,
        _delete: false,
      },
    ]);
  }

  // ---------- FAQs State ----------
  const [faqs, setFaqs] = useState<FaqState[]>(
    (initialFaqs ?? []).map((f) => ({
      id: f.id ?? `new_${crypto.randomUUID()}`,
      question: f.question ?? "",
      answer: f.answer ?? "",
      active: f.active ?? true,
      _delete: false,
    }))
  );

  function addFaq() {
    setFaqs((prev) => [
      ...prev,
      {
        id: `new_${crypto.randomUUID()}`,
        question: "",
        answer: "",
        active: true,
        _delete: false,
      },
    ]);
  }

  return (
    <>
      {/* Öffnungszeiten (DB-bound, voll editierbar) */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-sm font-medium text-[#1E293B]">Öffnungszeiten</h2>
          <p className="text-xs text-[#64748B]">
            Wird für Terminfindung genutzt.
          </p>
        </div>

        <form action={saveBusinessHoursAction} className="space-y-3">
          {bh.map((row, idx) => {
            const label = WEEKDAYS.find((w) => w.weekday === row.weekday)?.label ?? `Tag ${row.weekday}`;
            return (
              <div
  key={row.weekday}
  className={[
    "rounded-xl bg-[#F8FAFC] px-4 py-3",
    "md:grid md:items-center md:gap-3 md:rounded-xl md:bg-[#F8FAFC]",
    "md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]",
  ].join(" ")}
>
  {/* parallel arrays for server action */}
  <input type="hidden" name="bh_weekday" value={row.weekday} />
  <input type="hidden" name="bh_closed" value={row.closed ? "1" : "0"} />

  {/* Day */}
  <div className="text-sm font-medium text-[#1E293B] md:col-auto">
    {label}
  </div>

  {/* Mobile: times as 2-column */}
  <div className="mt-3 grid grid-cols-2 gap-3 md:mt-0 md:contents">
    <div className="space-y-1 md:col-auto">
      <div className="text-[11px] font-medium uppercase tracking-wide text-[#64748B] md:hidden">
        Von
      </div>
      <input
        name="bh_open"
        type="time"
        value={row.open}
        disabled={row.closed}
        onChange={(e) => patchBH(idx, { open: e.target.value })}
        className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
      />
    </div>

    <div className="space-y-1 md:col-auto">
      <div className="text-[11px] font-medium uppercase tracking-wide text-[#64748B] md:hidden">
        Bis
      </div>
      <input
        name="bh_close"
        type="time"
        value={row.close}
        disabled={row.closed}
        onChange={(e) => patchBH(idx, { close: e.target.value })}
        className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
      />
    </div>
  </div>

  {/* Closed toggle */}
  <div className="mt-3 flex justify-end md:mt-0 md:col-auto">
    <label className="inline-flex items-center gap-2 text-xs text-[#64748B]">
      <input
        type="checkbox"
        checked={row.closed}
        onChange={(e) => patchBH(idx, { closed: e.target.checked })}
        className="h-4 w-4 rounded border-slate-300 text-[#3B82F6]"
      />
      Geschlossen
    </label>
  </div>

  {/* Optional mobile hint */}
  {row.closed && (
    <p className="mt-2 text-xs text-slate-400 md:hidden">
      Dieser Tag wird bei Terminbuchungen übersprungen.
    </p>
  )}
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
        </form>
      </section>

      {/* Services (DB-bound, editierbar) */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-[#1E293B]">Services</h2>
            <p className="text-xs text-[#64748B]">Leistungen, die buchbar sind.</p>
          </div>
          <button
            type="button"
            onClick={addService}
            className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#3B82F6] hover:bg-[#EFF6FF]"
          >
            + Service hinzufügen
          </button>
        </div>

        <form action={saveServicesAction} className="space-y-3">
          {services.map((s, idx) => (
            <div
              key={s.id}
              className={[
                "grid gap-3 rounded-xl px-4 py-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto]",
                s._delete ? "bg-rose-50 border border-rose-100" : "bg-[#F8FAFC]",
              ].join(" ")}
            >
              {/* parallel arrays */}
              <input type="hidden" name="svc_id" value={s.id.startsWith("new_") ? "" : s.id} />
              <input type="hidden" name="svc_active" value={s.active ? "1" : "0"} />
              <input type="hidden" name="svc_delete" value={s._delete ? "1" : "0"} />

              <div className="space-y-1">
                <div className="text-[11px] font-medium uppercase tracking-wide text-[#64748B]">
                  Service
                </div>
                <input
                  name="svc_title"
                  value={s.title}
                  onChange={(e) =>
                    setServices((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x))
                    )
                  }
                  placeholder="z.B. Haarschnitt"
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none"
                />
              </div>

              <div className="space-y-1">
                <div className="text-[11px] font-medium uppercase tracking-wide text-[#64748B]">
                  Dauer (Min.)
                </div>
                <input
                  name="svc_duration"
                  type="number"
                  min={10}
                  step={5}
                  value={s.duration_min}
                  onChange={(e) =>
                    setServices((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, duration_min: Number(e.target.value || 0) } : x
                      )
                    )
                  }
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none"
                />
              </div>

              <div className="space-y-1">
                <div className="text-[11px] font-medium uppercase tracking-wide text-[#64748B]">
                  Preis (€)
                </div>
                <input
                  name="svc_price"
                  type="number"
                  min={0}
                  step={1}
                  value={s.price_eur}
                  onChange={(e) =>
                    setServices((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, price_eur: e.target.value } : x))
                    )
                  }
                  placeholder="optional"
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setServices((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, active: !x.active } : x))
                    )
                  }
                  className={[
                    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition",
                    s.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "mr-2 inline-block h-2 w-2 rounded-full",
                      s.active ? "bg-emerald-500" : "bg-slate-400",
                    ].join(" ")}
                  />
                  {s.active ? "Aktiv" : "Inaktiv"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setServices((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, _delete: !x._delete } : x))
                    )
                  }
                  className={[
                    "text-xs font-medium",
                    s._delete ? "text-rose-600" : "text-slate-400 hover:text-rose-500",
                  ].join(" ")}
                >
                  {s._delete ? "Wird gelöscht" : "Entfernen"}
                </button>
              </div>
            </div>
          ))}

          {/* Optionaler Hinweis: Server Action interpretiert price string -> cents */}
          {/* (wir übergeben svc_price als Zahl/String, Server Action macht parse) */}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="rounded-lg bg-[#10B981] px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-[#059669]"
              onClick={() => {
                // just to normalize prices client-side before submit (optional)
                // (keine Pflicht – Server kann’s auch)
              }}
            >
              Services speichern
            </button>
          </div>
        </form>
      </section>

      {/* FAQ (DB-bound, editierbar) */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-[#1E293B]">FAQ-Bausteine</h2>
            <p className="text-xs text-[#64748B]">Antworten, die die AI direkt nutzen kann.</p>
          </div>
          <button
            type="button"
            onClick={addFaq}
            className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#3B82F6] hover:bg-[#EFF6FF]"
          >
            + Frage hinzufügen
          </button>
        </div>

        <form action={saveFaqsAction} className="space-y-3">
          {faqs.map((f, idx) => (
            <div
              key={f.id}
              className={[
                "space-y-2 rounded-xl p-4",
                f._delete ? "bg-rose-50 border border-rose-100" : "bg-[#F8FAFC]",
              ].join(" ")}
            >
              <input type="hidden" name="faq_id" value={f.id.startsWith("new_") ? "" : f.id} />
              <input type="hidden" name="faq_active" value={f.active ? "1" : "0"} />
              <input type="hidden" name="faq_delete" value={f._delete ? "1" : "0"} />

              <div className="space-y-1">
                <div className="text-[11px] font-medium uppercase tracking-wide text-[#64748B]">
                  Frage
                </div>
                <input
                  name="faq_q"
                  value={f.question}
                  onChange={(e) =>
                    setFaqs((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, question: e.target.value } : x))
                    )
                  }
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none"
                  placeholder="z.B. Wie lange dauert…?"
                />
              </div>

              <div className="space-y-1">
                <div className="text-[11px] font-medium uppercase tracking-wide text-[#64748B]">
                  Antwort
                </div>
                <textarea
                  name="faq_a"
                  value={f.answer}
                  onChange={(e) =>
                    setFaqs((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, answer: e.target.value } : x))
                    )
                  }
                  rows={2}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none"
                  placeholder="Kurze, klare Antwort…"
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setFaqs((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, active: !x.active } : x))
                    )
                  }
                  className={[
                    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition",
                    f.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "mr-2 inline-block h-2 w-2 rounded-full",
                      f.active ? "bg-emerald-500" : "bg-slate-400",
                    ].join(" ")}
                  />
                  {f.active ? "Aktiv" : "Inaktiv"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFaqs((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, _delete: !x._delete } : x))
                    )
                  }
                  className={[
                    "text-xs font-medium",
                    f._delete ? "text-rose-600" : "text-slate-400 hover:text-rose-500",
                  ].join(" ")}
                >
                  {f._delete ? "Wird gelöscht" : "Entfernen"}
                </button>
              </div>
            </div>
          ))}

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
    </>
  );
}
