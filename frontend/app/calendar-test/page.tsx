"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser"; // hast du eben angelegt

export default function CalendarTestPage() {
  const [status, setStatus] = useState<"checking"|"connected"|"disconnected">("checking");
  const [uid, setUid] = useState<string | null>(null);
  const [log, setLog] = useState("");

  function append(s: string) { setLog(p => `[${new Date().toLocaleTimeString()}] ${s}\n` + p); }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabaseBrowser.auth.getUser();
      setUid(user?.id ?? null);

      try {
        const r = await fetch("/api/google/auth-status", { cache: "no-store" });
        if (r.status === 401) return setStatus("disconnected");
        const j = await r.json();
        setStatus(j.connected ? "connected" : "disconnected");
      } catch {
        setStatus("disconnected");
      }
    })();
  }, []);

  async function connectGoogle() {
    if (!uid) {
      append("Nicht eingeloggt. Öffne /login …");
      window.location.href = "/login?redirectTo=/calendar-test";
      return;
    }
    // wichtig: uid mitschicken
    window.location.href = `/api/google/oauth/start?uid=${encodeURIComponent(uid)}`;
  }

  async function createTestEvent() {
    if (!uid) {
      append("Kein uid – bitte einloggen.");
      return;
    }
    append("Event anlegen …");
    const start = new Date(Date.now() + 5 * 60 * 1000);
    const end = new Date(Date.now() + 35 * 60 * 1000);
    const r = await fetch("/api/google/calendar/create-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid, // <- Fallback, falls Server keine Cookies sieht
        summary: "Testtermin – AI-Rezeptionist",
        description: "Angelegt aus /calendar-test",
        startISO: start.toISOString(),
        endISO: end.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Berlin",
      }),
    });
    const j = await r.json();
    if (!r.ok) {
      append(`Fehler: ${j?.error || r.statusText}`);
      alert(`Fehler: ${j?.error || r.statusText}`);
      return;
    }
    append(`Event erstellt: ${j.eventId}`);
    alert("✅ Test-Termin erstellt! Check Google-Kalender.");
  }

  return (
    <div className="mx-auto max-w-xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Google Kalender – Quick Test</h1>
      <div className="rounded border p-4 space-y-3">
        <div>Status: <b>{status === "checking" ? "prüfe…" : status === "connected" ? "verbunden" : "nicht verbunden"}</b></div>
        <div className="flex gap-3">
          <a className="rounded bg-gray-700 px-3 py-2 text-white" href={`/login?redirectTo=${encodeURIComponent("/calendar-test")}`}>Login</a>
          <button onClick={connectGoogle} className="rounded bg-blue-600 px-3 py-2 text-white">Google verbinden</button>
          <button onClick={createTestEvent} disabled={status!=="connected"} className={`rounded px-3 py-2 text-white ${status==="connected"?"bg-emerald-600":"bg-gray-400 cursor-not-allowed"}`}>Test-Event anlegen</button>
        </div>
      </div>
      <textarea className="w-full h-56 border rounded p-2 font-mono text-xs" readOnly value={log}/>
    </div>
  );
}
