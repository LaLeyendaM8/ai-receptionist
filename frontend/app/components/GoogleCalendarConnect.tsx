// frontend/app/onboarding/GoogleCalendarConnect.tsx
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type Status = "loading" | "connected" | "disconnected" | "error";

type Props = {
  returnTo?: string;
};

export default function GoogleCalendarConnect({ returnTo }: Props) {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();

  // ✅ FIX: typo + auto-return je nach page
  const finalReturnTo =
    returnTo ??
    (pathname?.startsWith("/dashboard") ? "/dashboard/settings" : "/onboarding");

  // ✅ FIX: auf DEINE Start-Route zeigen (bei dir: /api/google/oauth)
  const href = `/api/google/oauth/start?returnTo=${encodeURIComponent(finalReturnTo)}`;

  async function loadStatus() {
    setError(null);
    setStatus("loading");
    try {
      const res = await fetch("/api/google/auth-status");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Unbekannter Fehler beim Laden des Status.");
        setStatus("error");
        return;
      }
      const data = await res.json();
      setStatus(data.connected ? "connected" : "disconnected");
    } catch (e) {
      console.error("google auth-status error", e);
      setStatus("error");
      setError("Fehler beim Laden des Google-Status.");
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  function handleConnectClick() {
    // ✅ FIX: nicht hardcoded "/api/google/oauth/start"
    // sondern die richtige Route inkl. returnTo
    window.location.href = href;
  }

  const isConnected = status === "connected";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Google Kalender verbinden
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Verbinde deinen Google Kalender, damit ReceptaAI automatisch Termine
            eintragen und geblockte Zeiten berücksichtigen kann.
          </p>

          <div className="mt-4 text-xs text-slate-500">
            {status === "loading" && <span>Verbindungsstatus wird geladen…</span>}

            {status === "connected" && (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
                <span className="mr-1 h-2 w-2 rounded-full bg-emerald-500" />
                Google Kalender ist verbunden.
              </span>
            )}

            {status === "disconnected" && (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
                <span className="mr-1 h-2 w-2 rounded-full bg-amber-500" />
                Noch nicht verbunden. Bitte verbinde deinen Kalender.
              </span>
            )}

            {status === "error" && (
              <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 font-medium text-rose-700">
                <span className="mr-1 h-2 w-2 rounded-full bg-rose-500" />
                Konnte den Status nicht laden.
                {error ? ` (${error})` : null}
              </span>
            )}
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
          <button
            type="button"
            onClick={handleConnectClick}
            disabled={status === "loading"}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isConnected ? "Erneut verbinden" : "Mit Google verbinden"}
          </button>

          <button
            type="button"
            onClick={loadStatus}
            className="text-xs text-slate-400 underline underline-offset-2 hover:text-slate-500"
          >
            Status aktualisieren
          </button>
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Hinweis: Du wirst zu Google weitergeleitet, um den Zugriff auf deinen
        Kalender zu bestätigen.
      </p>
    </section>
  );
}
