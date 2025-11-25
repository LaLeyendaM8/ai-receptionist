"use client";

import { useState } from "react";

export function BillingButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    try {
      setError(null);
      setLoading(true);

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("checkout_failed", data);
        setError(data?.error || "Unbekannter Fehler beim Checkout");
        return;
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError("Keine Checkout-URL erhalten");
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Fehler beim Starten des Checkouts");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={startCheckout}
        disabled={loading}
        className="rounded-md bg-blue-600 px-4 py-2 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Weiterleitung zu Stripe..." : "Abo starten"}
      </button>

      {error && (
        <p className="text-sm text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}
