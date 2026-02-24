// frontend/app/dashboard/calls/page.tsx

import { redirect } from "next/navigation";
import { createClients } from "@/lib/supabaseClients";
import { getCurrentUserId } from "@/lib/authServer";
import { Phone, Filter, ChevronDown, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

function getResultBadgeClasses(status: string | null | undefined) {
  const value = (status ?? "").toLowerCase();

  if (value.includes("termin")) {
    // "Termin gebucht"
    return "bg-emerald-50 text-emerald-700";
  }
  if (value.includes("gelöst") || value.includes("resolved")) {
    return "bg-[#EFF6FF] text-[#1D4ED8]"; // blau
  }
  if (value.includes("voicemail") || value.includes("mailbox")) {
    return "bg-slate-600 text-white";
  }
  if (value.includes("verpasst") || value.includes("missed")) {
    return "bg-rose-50 text-rose-700";
  }

  return "bg-slate-100 text-slate-700";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDuration(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return "-";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")} min`;
}

export default async function CallsPage() {
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
    console.error("[CALLS] client_load_failed", clientErr);
    redirect("/onboarding");
  }

  const clientId = client.id;

  const { data: calls } = await supabase
    .from("calls")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = calls ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-[#1E293B]">Calls</h1>
        <p className="mt-1 text-sm text-[#64748B]">
          Alle eingehenden Anrufe im Überblick.
        </p>
      </div>

      {/* Filter-Card (noch ohne echte Logik) */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          {/* Zeitraum */}
          <button
            type="button"
            className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#1E293B]"
          >
            <span className="inline-flex items-center gap-2">
              <Filter className="h-4 w-4 text-[#64748B]" />
              Zeitraum
            </span>
            <ChevronDown className="h-4 w-4 text-[#94A3B8]" />
          </button>

          {/* Ergebnis */}
          <button
            type="button"
            className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#1E293B]"
          >
            <span>Ergebnis</span>
            <ChevronDown className="h-4 w-4 text-[#94A3B8]" />
          </button>

          {/* Sprache */}
          <button
            type="button"
            className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#1E293B]"
          >
            <span>Sprache</span>
            <ChevronDown className="h-4 w-4 text-[#94A3B8]" />
          </button>
        </div>
      </section>

      {/* Calls-Liste */}
<section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
  <div className="mb-4 flex items-center gap-2">
    <Phone className="h-4 w-4 text-[#3B82F6]" />
    <h2 className="text-sm font-medium text-[#1E293B]">Letzte Anrufe</h2>
  </div>

  {/* DESKTOP TABLE */}
  <div className="hidden md:block overflow-x-auto">
    <table className="min-w-full text-left text-sm text-[#1E293B]">
      <thead>
        <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#64748B]">
          <th className="px-4 py-3">Datum</th>
          <th className="px-4 py-3">Von</th>
          <th className="px-4 py-3">Ergebnis</th>
          <th className="px-4 py-3">Dauer</th>
          <th className="px-4 py-3">Sprache</th>
          <th className="px-4 py-3 text-right">Aktion</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={6} className="px-4 py-6 text-center text-sm text-[#94A3B8]">
              Noch keine Anrufe vorhanden.
            </td>
          </tr>
        )}

        {rows.map((c: any) => (
          <tr
            key={c.id}
            className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]"
          >
            <td className="px-4 py-3 text-sm text-[#1E293B] align-top">
              {formatDateTime(c.created_at)}
            </td>

            <td className="px-4 py-3 text-sm text-[#1E293B] align-top">
              <div className="flex flex-col">
                <span>{c.caller_name ?? "Unbekannter Anrufer"}</span>
                <span className="text-xs text-[#64748B]">{c.from_number ?? "-"}</span>
              </div>
            </td>

            <td className="px-4 py-3 align-top">
              <span
                className={
                  "inline-flex rounded-full px-3 py-1 text-xs font-medium " +
                  getResultBadgeClasses(c.status)
                }
              >
                {c.status ?? "Unbekannt"}
              </span>
            </td>

            <td className="px-4 py-3 text-sm text-[#1E293B] align-top">
              {formatDuration(c.duration_seconds)}
            </td>

            <td className="px-4 py-3 text-sm text-[#1E293B] align-top">
              <span className="inline-flex items-center rounded-md bg-[#1E293B] px-2 py-1 text-xs font-medium text-white">
                {(c.language ?? "DE").toUpperCase()}
              </span>
            </td>

            <td className="px-4 py-3 text-right align-top">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#3B82F6] hover:bg-[#EFF6FF]"
              >
                <FileText className="h-3 w-3" />
                Details
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>

  {/* MOBILE CARDS */}
  <div className="mt-3 space-y-3 md:hidden">
    {rows.length === 0 && (
      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-xs text-[#64748B]">
        Noch keine Anrufe vorhanden.
      </div>
    )}

    {rows.map((c: any) => (
      <div key={c.id} className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-[#1E293B]">
              {c.caller_name ?? "Unbekannter Anrufer"}
            </div>
            <div className="mt-0.5 text-xs text-[#64748B]">{c.from_number ?? "-"}</div>

            <div className="mt-2 text-xs text-[#64748B]">
              {formatDateTime(c.created_at)} • {formatDuration(c.duration_seconds)}
            </div>
          </div>

          <span
            className={
              "inline-flex h-fit rounded-full px-3 py-1 text-xs font-medium " +
              getResultBadgeClasses(c.status)
            }
          >
            {c.status ?? "Unbekannt"}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="inline-flex items-center rounded-md bg-[#1E293B] px-2 py-1 text-[11px] font-medium text-white">
            {(c.language ?? "DE").toUpperCase()}
          </span>

          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-medium text-[#3B82F6] hover:bg-[#EFF6FF]"
          >
            <FileText className="h-3 w-3" />
            Details
          </button>
        </div>
      </div>
    ))}
  </div>
</section>
    </div>
  );
}
