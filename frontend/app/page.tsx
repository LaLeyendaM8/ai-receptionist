"use client";

import { useState } from "react";

export default function HomePage() {
  const [loading, setLoading] = useState(false);

  async function startCheckout() {
    try {
      setLoading(true);

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
      });

      if (!res.ok) {
        console.error("checkout_failed", await res.json());
        return;
      }

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("no_checkout_url_returned", data);
      }
    } catch (error) {
      console.error("checkout_error", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="text-lg font-semibold tracking-tight">
            ReceptaAI
          </div>
          <a
            href="/login"
            className="text-sm text-zinc-300 hover:text-white underline-offset-4 hover:underline"
          >
            Login
          </a>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col items-center gap-10 px-4 py-16 text-center">
        <h1 className="max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl">
          Der AI-Telefonassistent für kleine Unternehmen.
        </h1>
        <p className="max-w-xl text-zinc-300">
          ReceptaAI nimmt Anrufe automatisch entgegen, beantwortet häufige
          Fragen und bucht Termine direkt in Ihren Kalender – damit kein Anruf
          mehr verloren geht.
        </p>

        <button
          onClick={startCheckout}
          disabled={loading}
          className="mt-4 rounded-md bg-emerald-500 px-6 py-3 text-sm font-semibold text-zinc-900 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Weiterleitung zu Stripe…" : "Jetzt starten – Abo abschließen"}
        </button>

        <p className="text-xs text-zinc-500">
          Sie werden zu Stripe weitergeleitet, um das ReceptaAI-Starterpaket
          sicher zu bezahlen.
        </p>
      </main>
    </div>
  );
}
