// app/login/page.tsx
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";


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

    const { error } = await supabaseBrowser.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    // Login ok → Dashboard
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 bg-white shadow-sm border rounded-xl p-6"
      >
        <h1 className="text-xl font-semibold text-center">Login</h1>

        <div className="space-y-1">
          <label className="text-sm font-medium">E-Mail</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="you@example.com"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Passwort</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="••••••••"
            required
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 whitespace-pre-line">
            {error}
          </p>
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
