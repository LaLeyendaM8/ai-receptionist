"use client";

import { useEffect, useState } from "react";

type Status = "loading" | "connected" | "disconnected" | "error";

export default function GoogleCalendarConnect() {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  async function loadStatus() {
    try {
      setError(null);
      const res = await fetch("/api/google/auth-status");
      if (!res.ok) {
        setStatus("error");
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Unbekannter Fehler beim Laden des Status.");
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
    // Direkt auf die OAuth-Start-Route navigieren (die macht den Redirect)
    window.location.href = "/api/google/oauth/start";
  }

  const isConnected = status === "connected";

  return (
    <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-lg font-semibold">Google Kalender verbinden</h2>
      <p className="text-sm text-gray-600">
        Verbinde deinen Google Kalender, damit ReceptaAI automatisch Termine
        für dich eintragen kann.
      </p>

      <div className="flex items-center justify-between gap-3">
        <div className="text-sm">
          {status === "loading" && <span>Verbindungsstatus wird geladen…</span>}
          {status === "connected" && (
            <span className="font-medium text-green-700">
              ✅ Google Kalender ist verbunden.
            </span>
          )}
          {status === "disconnected" && (
            <span className="text-red-600">
              Noch nicht verbunden. Bitte verbinde deinen Kalender.
            </span>
          )}
          {status === "error" && (
            <span className="text-red-600">
              Konnte den Status nicht laden.
              {error ? ` (${error})` : null}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleConnectClick}
          disabled={status === "loading"}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isConnected ? "Erneut verbinden" : "Mit Google verbinden"}
        </button>
      </div>

      {/* Optional: kleiner Hinweis */}
      <p className="text-xs text-gray-500">
        Hinweis: Du wirst zu Google weitergeleitet, um den Zugriff auf deinen
        Kalender zu bestätigen.
      </p>
    </section>
  );
}