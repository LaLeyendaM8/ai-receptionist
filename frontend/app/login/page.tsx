// app/login/page.tsx
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Login fehlgeschlagen.");
        setLoading(false);
        return;
      }

      // ✅ Login erfolgreich → ab ins Admin-Dashboard
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setError("Unerwarteter Fehler beim Login.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm border rounded-lg p-6 space-y-4"
      >
        <h1 className="text-xl font-semibold text-center">
          AI-Receptionist – Login
        </h1>

        <div className="space-y-1">
          <label className="block text-sm font-medium">E-Mail</label>
          <input
            type="email"
            className="w-full border rounded px-3 py-2 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium">Passwort</label>
          <input
            type="password"
            className="w-full border rounded px-3 py-2 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 whitespace-pre-line">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-black text-white py-2 text-sm font-medium disabled:opacity-60"
        >
          {loading ? "Einloggen..." : "Login"}
        </button>
      </form>
    </div>
  );
}
