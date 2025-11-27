// frontend/app/dashboard/appointments/page.tsx

import { redirect } from "next/navigation";
import { createClients } from "@/lib/supabaseClients";
import { getCurrentUserId } from "@/lib/authServer";
import { CalendarClock, Check, X, MoreHorizontal } from "lucide-react";

export const dynamic = "force-dynamic";

function getStatusBadgeClasses(status: string | null | undefined) {
  const value = (status ?? "").toLowerCase();

  if (value.includes("bestätigt") || value.includes("confirmed")) {
    return "bg-emerald-50 text-emerald-700";
  }
  if (value.includes("ausstehend") || value.includes("pending")) {
    return "bg-amber-50 text-amber-700";
  }
  if (value.includes("abgesagt") || value.includes("cancelled")) {
    return "bg-rose-50 text-rose-700";
  }

  return "bg-slate-100 text-slate-700";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function AppointmentsPage() {
  const supabase = await createClients();
  const userId = await getCurrentUserId(supabase);

  if (!userId) {
    redirect("/login");
  }

  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("id")
    .eq("owner_user", userId)
    .maybeSingle();

  if (clientErr || !client) {
    console.error("[APPOINTMENTS] client_load_failed", clientErr);
    redirect("/onboarding");
  }

  const clientId = client.id;

  const { data: appointments } = await supabase
    .from("appointments")
    .select("*")
    .eq("client_id", clientId)
    .order("start_at", { ascending: true })
    .limit(50);

  const rows = appointments ?? [];

  const todayCount = rows.filter((a: any) => {
    if (!a.start_at) return false;
    const d = new Date(a.start_at);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }).length;

  const weekTotal = rows.length;
  const openCount = rows.filter((a: any) => {
    const s = (a.status ?? "").toLowerCase();
    return s.includes("ausstehend") || s.includes("pending");
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1E293B]">
            Appointments
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Verwalte alle gebuchten Termine.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center rounded-lg bg-[#3B82F6] px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-[#2563EB]"
        >
          + Neu anlegen
        </button>
      </div>

      {/* Stat-Karten unten wie im Figma (Heute / Diese Woche / Ausstehend) */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 text-sm text-[#1E293B] shadow-sm">
          <p className="text-xs text-[#64748B]">Heute</p>
          <p className="mt-1 text-2xl font-semibold">{todayCount}</p>
        </div>
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 text-sm text-[#1E293B] shadow-sm">
          <p className="text-xs text-[#64748B]">Diese Woche</p>
          <p className="mt-1 text-2xl font-semibold">{weekTotal}</p>
        </div>
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 text-sm text-[#1E293B] shadow-sm">
          <p className="text-xs text-[#64748B]">Ausstehend</p>
          <p className="mt-1 text-2xl font-semibold">{openCount}</p>
        </div>
      </section>

      {/* Terminliste */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-[#3B82F6]" />
          <h2 className="text-sm font-medium text-[#1E293B]">
            Gebuchte Termine
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-[#1E293B]">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#64748B]">
                <th className="px-4 py-3">Kunde</th>
                <th className="px-4 py-3">Datum</th>
                <th className="px-4 py-3">Dienstleistung</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-sm text-[#94A3B8]"
                  >
                    Noch keine Termine vorhanden.
                  </td>
                </tr>
              )}

              {rows.map((a: any) => (
                <tr
                  key={a.id}
                  className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]"
                >
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-col text-sm text-[#1E293B]">
                      <span>{a.customer_name ?? "Unbekannter Kunde"}</span>
                      <span className="text-xs text-[#64748B]">
                        {a.customer_phone ?? ""}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-sm text-[#1E293B]">
                    <div className="flex flex-col">
                      <span>{formatDate(a.start_at)}</span>
                      <span className="text-xs text-[#64748B]">
                        {formatTime(a.start_at)} Uhr
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-sm text-[#1E293B]">
                    {a.title ?? "Termin"}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span
                      className={
                        "inline-flex rounded-full px-3 py-1 text-xs font-medium " +
                        getStatusBadgeClasses(a.status)
                      }
                    >
                      {a.status ?? "Unbekannt"}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                        title="Bestätigen"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100"
                        title="Absagen"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC]"
                        title="Mehr"
                      >
                        <MoreHorizontal className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
