'use client'

import { useState } from "react";

export function BillingButton() {
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
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={startCheckout}
      disabled={loading}
      className="rounded-md bg-blue-600 px-4 py-2 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
    >
      {loading ? "Weiterleitung zu Stripe..." : "Abo starten"}
    </button>
  );
}