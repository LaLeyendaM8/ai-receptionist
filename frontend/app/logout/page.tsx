// app/logout/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useState } from "react";

export default function LogoutPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    try {
      setLoading(true);
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900">
            <LogOut className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Ausloggen</h1>
            <p className="mt-1 text-sm text-slate-600">
              Du wirst sicher aus deinem ReceptaAI-Account ausgeloggt.
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          disabled={loading}
          className="mt-6 w-full inline-flex items-center justify-center rounded-xl bg-[#3B82F6] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#2563EB] disabled:opacity-70"
        >
          {loading ? "Logout..." : "Jetzt ausloggen"}
        </button>

        <button
          onClick={() => router.back()}
          className="mt-3 w-full inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-[#3B82F6] hover:text-[#3B82F6]"
        >
          Abbrechen
        </button>
      </div>
    </main>
  );
}