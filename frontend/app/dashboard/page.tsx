// frontend/app/dashboard/page.tsx

import React from "react";
import Link from "next/link";
import { createClients } from "@/lib/supabaseClients";
import { getCurrentUserId } from "@/lib/authServer";
import {
  CalendarDays,
  PhoneCall,
  ClipboardList,
  TrendingUp,
  Clock,
} from "lucide-react";

export const dynamic = "force-dynamic";

type CallRow = {
  id: string;
  created_at: string;
  status: string | null;
  from_number: string | null;
  language?: string | null;
  duration_seconds?: number | null;
};

type AppointmentRow = {
  id: string;
  start_at: string;
  status: string | null;
  title?: string | null;
};

async function getDashboardData(userId: string) {
  const supabase = await createClients();

  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("id")
    .eq("owner_user", userId)
    .maybeSingle();

  if (clientErr || !client) {
    console.error("dashboard_client_load_failed", clientErr);
    return null;
  }

  const clientId = client.id;

  const [{ data: calls }, { data: appointments }, { count: openHandoffs }] =
    await Promise.all([
      supabase
        .from("calls")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(50),

      supabase
        .from("appointments")
        .select("*")
        .eq("client_id", clientId)
        .order("start_at", { ascending: false })
        .limit(50),

      // ✅ nur Count (schnell + günstig)
      supabase
        .from("handoffs")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("status", "open"),
    ]);

  return {
    calls: (calls ?? []) as CallRow[],
    appointments: (appointments ?? []) as AppointmentRow[],
    openHandoffs: openHandoffs ?? 0,
  };
}

function formatRelative(dateString: string) {
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMinutes < 1) return "vor wenigen Sekunden";
  if (diffMinutes < 60) return `vor ${diffMinutes} Min`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `vor ${diffHours} Std`;

  const diffDays = Math.round(diffHours / 24);
  return `vor ${diffDays} Tagen`;
}

function formatDuration(secondsTotal: number | null | undefined) {
  const seconds = secondsTotal ?? 0;
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;
  return `${minutes}:${String(restSeconds).padStart(2, "0")} min`;
}

type StatCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend?: string;
  trendPositive?: boolean;
  href?: string; // ✅ neu
};


function StatCard({ icon, label, value, trend, trendPositive, href }: StatCardProps) {
  const CardInner = (
    <div
      className={[
        "rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm transition",
        href ? "cursor-pointer hover:bg-[#F8FAFC] hover:shadow-md" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#3B82F6]/5">
          {icon}
        </div>

        {trend && (
          <span
            className={
              trendPositive
                ? "text-xs font-medium text-emerald-500"
                : "text-xs font-medium text-rose-500"
            }
          >
            {trend}
          </span>
        )}
      </div>

      <div className="mt-4 text-sm text-[#64748B]">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-[#1E293B]">{value}</div>
    </div>
  );

  if (!href) return CardInner;

  return (
    <Link href={href} className="block focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30 rounded-2xl">
      {CardInner}
    </Link>
  );
}


export default async function DashboardPage() {
  const supabase = await createClients();
  const userId = await getCurrentUserId(supabase);

  if (!userId) {
    // wird bereits im Layout redirected, hier einfach nichts rendern
    return null;
  }

  const data = await getDashboardData(userId);

  const calls = data?.calls ?? [];
  const appointments = data?.appointments ?? [];
  const openHandoffs = data?.openHandoffs ?? 0;

  // Zeitraum: "heute"
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1
  );

  // Calls heute
  const callsToday = calls.filter((c) => {
    const d = new Date(c.created_at);
    return d >= startOfToday && d < endOfToday;
  }).length;

  // ✅ Gebuchte Termine (gesamt, nicht nur heute)
  const bookedAppointments = appointments.filter((a) => {
    const s = (a.status ?? "").toLowerCase();
    return s === "booked";
  }).length;

  // Antwortquote (MVP: missed = nicht beantwortet)
  const answeredCalls = calls.filter(
    (c) => c.status && c.status.toLowerCase() !== "missed"
  );
  const responseRate =
    calls.length > 0
      ? Math.round((answeredCalls.length / calls.length) * 1000) / 10
      : 0;

  // Durchschnittsdauer
  const avgDurationSeconds =
    calls.length > 0
      ? Math.round(
          calls.reduce((sum, c) => sum + (c.duration_seconds ?? 0), 0) /
            calls.length
        )
      : 0;

  // Letzte Aktivitäten: einfach die letzten 5 Calls
  const recentCalls = calls.slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold text-[#1E293B]">Overview</h1>
        <p className="mt-1 text-sm text-[#64748B]">
          Willkommen zurück! Hier ist deine Übersicht.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {/* ✅ neu: Handoffs offen */}
        <StatCard
  href="/dashboard/handoffs"
  icon={<ClipboardList className="h-5 w-5 text-amber-500" />}
  label="Handoffs offen"
  value={String(openHandoffs)}
  trend={openHandoffs > 0 ? "Action needed" : "Alles ruhig"}
  trendPositive={openHandoffs === 0}
/>

<StatCard
  href="/dashboard/calls"
  icon={<PhoneCall className="h-5 w-5 text-[#3B82F6]" />}
  label="Anrufe heute"
  value={String(callsToday)}
  trend="+12%"
  trendPositive
/>

<StatCard
  href="/dashboard/appointments"
  icon={<CalendarDays className="h-5 w-5 text-emerald-500" />}
  label="Gebuchte Termine"
  value={String(bookedAppointments)}
  trend="+8%"
  trendPositive
/>

        {/* lass ich drin, weil du es schon designed hast */}
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-[#3B82F6]" />}
          label="Antwortquote"
          value={`${responseRate.toFixed(1)}%`}
          trend="+2.3%"
          trendPositive
        />
      </div>

      {/* Anrufe (7 Tage) – Chart-Card (Platzhalter-Chart) */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-[#1E293B]">Anrufe (7 Tage)</h2>
          <span className="text-xs text-[#64748B]">Demo-Chart</span>
        </div>
        <div className="h-52 rounded-xl bg-[#F8FAFC]">
          <div className="flex h-full items-center justify-center text-xs text-[#64748B]">
            Chart-Visualisierung folgt (Demo-MVP)
          </div>
        </div>
      </div>

{/* Letzte Aktivitäten */}
<div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
  <h2 className="text-sm font-medium text-[#1E293B]">Letzte Aktivitäten</h2>

  {/* DESKTOP: Table */}
  <div className="mt-4 hidden md:block overflow-x-auto">
    <table className="min-w-full text-left text-sm">
      <thead className="border-b border-[#E2E8F0] text-xs text-[#64748B]">
        <tr>
          <th className="py-2 pr-4">Von</th>
          <th className="py-2 pr-4">Ergebnis</th>
          <th className="py-2 pr-4">Zeit</th>
          <th className="py-2 pr-4">Dauer</th>
          <th className="py-2 pr-4">Sprache</th>
        </tr>
      </thead>

      <tbody className="divide-y divide-[#E2E8F0]">
        {recentCalls.length === 0 && (
          <tr>
            <td colSpan={5} className="py-6 text-center text-xs text-[#64748B]">
              Noch keine Anrufe vorhanden.
            </td>
          </tr>
        )}

        {recentCalls.map((call) => (
          <tr key={call.id}>
            <td className="py-3 pr-4 text-sm text-[#1E293B]">
              {call.from_number ?? "Unbekannt"}
            </td>

            <td className="py-3 pr-4">
              <span
                className={[
                  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                  call.status?.toLowerCase() === "missed"
                    ? "bg-rose-50 text-rose-600"
                    : call.status?.toLowerCase() === "voicemail"
                    ? "bg-slate-800 text-slate-50"
                    : "bg-emerald-50 text-emerald-600",
                ].join(" ")}
              >
                {call.status ?? "Unbekannt"}
              </span>
            </td>

            <td className="py-3 pr-4 text-xs text-[#64748B]">
              {formatRelative(call.created_at)}
            </td>

            <td className="py-3 pr-4 text-xs text-[#1E293B]">
              {formatDuration(call.duration_seconds)}
            </td>

            <td className="py-3 pr-4">
              <span className="inline-flex items-center rounded-md bg-slate-800 px-2 py-1 text-[11px] font-medium text-white">
                {(call.language ?? "DE").toUpperCase()}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>

  {/* MOBILE: Cards */}
  <div className="mt-4 space-y-3 md:hidden">
    {recentCalls.length === 0 && (
      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-xs text-[#64748B]">
        Noch keine Anrufe vorhanden.
      </div>
    )}

    {recentCalls.map((call) => {
      const status = (call.status ?? "Unbekannt").toLowerCase();

      const statusClass =
        status === "missed"
          ? "bg-rose-50 text-rose-600"
          : status === "voicemail"
          ? "bg-slate-800 text-slate-50"
          : "bg-emerald-50 text-emerald-600";

      return (
        <div
          key={call.id}
          className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[#1E293B]">
                {call.from_number ?? "Unbekannt"}
              </div>
              <div className="mt-1 text-xs text-[#64748B]">
                {formatRelative(call.created_at)} •{" "}
                {formatDuration(call.duration_seconds)}
              </div>
            </div>

            <span
              className={[
                "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                statusClass,
              ].join(" ")}
            >
              {call.status ?? "Unbekannt"}
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-[#64748B]">Sprache</span>
            <span className="inline-flex items-center rounded-md bg-slate-800 px-2 py-1 text-[11px] font-medium text-white">
              {(call.language ?? "DE").toUpperCase()}
            </span>
          </div>
        </div>
      );
    })}
  </div>

  {/* Footer hint bleibt für alle */}
  <div className="mt-4 flex items-center gap-2 text-xs text-[#64748B]">
    <Clock className="h-4 w-4" />
    Durchschnittliche Dauer:{" "}
    <span className="font-medium text-[#1E293B]">
      {formatDuration(avgDurationSeconds)}
    </span>
  </div>
</div>
    </div>
  );
}
