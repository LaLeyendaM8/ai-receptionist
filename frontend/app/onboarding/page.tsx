// app/onboarding/page.tsx
"use client";
import { useState } from "react";

type HourRow = { weekday: number; open_min: number; close_min: number; is_closed: boolean };
type ServiceRow = { key: string; label: string; durationMin: number };

export default function OnboardingPage() {
  const [client, setClient] = useState({ name: "", phone: "", email: "" });
  const [hours, setHours] = useState<HourRow[]>(
    Array.from({ length: 7 }).map((_, i) => ({ weekday: i, open_min: 9*60, close_min: 18*60, is_closed: i===0 }))
  );
  const [services, setServices] = useState<ServiceRow[]>([
    { key: "haircut", label: "Haarschnitt", durationMin: 30 },
  ]);

  async function save() {
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client, hours, services }),
    });
    alert(res.ok ? "Gespeichert" : "Fehler beim Speichern");
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Onboarding</h1>

      <div className="space-y-2">
        <input className="border p-2 w-full" placeholder="Firmenname"
          value={client.name} onChange={e=>setClient(c=>({ ...c, name: e.target.value }))}/>
        <input className="border p-2 w-full" placeholder="Telefon"
          value={client.phone} onChange={e=>setClient(c=>({ ...c, phone: e.target.value }))}/>
        <input className="border p-2 w-full" placeholder="E-Mail"
          value={client.email} onChange={e=>setClient(c=>({ ...c, email: e.target.value }))}/>
      </div>

      {/* (Optional) einfache Eingaben für hours/services – für MVP reicht das) */}

      <button onClick={save} className="px-4 py-2 bg-black text-white rounded">
        Speichern
      </button>
    </div>
  );
}
