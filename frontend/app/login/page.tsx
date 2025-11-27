// frontend/app/login/page.tsx
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

    if (!email || !password) {
      setError("Bitte E-Mail und Passwort eingeben.");
      return;
    }

    try {
      setLoading(true);

      const { error: loginError } = await supabaseBrowser.auth.signInWithPassword(
        {
          email,
          password,
        }
      );

      if (loginError) {
        // Supabase-Fehlertext nicht 1:1 zeigen, sondern etwas freundlicher
        setError("Login fehlgeschlagen. Bitte Zugangsdaten prüfen.");
        return;
      }

      router.push("/dashboard");
    } catch (err) {
      console.error("[LOGIN] unexpected error", err);
      setError("Es ist ein unerwarteter Fehler aufgetreten. Bitte später erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand-background flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md border border-brand-border p-8 space-y-8">
        {/* Logo / Brand */}
        <div className="flex items-center justify-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-brand-primary/10 flex items-center justify-center">
            {/* kleines Telefon-Icon als Platzhalter – kann später mit echtem SVG ersetzt werden */}
            <span className="text-brand-primary text-lg">📞</span>
          </div>
          <div>
            <p className="text-sm text-gray-500">Willkommen zurück bei</p>
            <p className="text-lg" style={{ fontWeight: 600 }}>
              ReceptaAI
            </p>
          </div>
        </div>

        {/* Headline + Copy */}
        <div className="space-y-1 text-center">
          <h1 className="text-xl" style={{ fontWeight: 600 }}>
            In dein Dashboard einloggen
          </h1>
          <p className="text-sm text-gray-500">
            Verwalte Anrufe, Termine und Einstellungen deiner ReceptaAI-Instanz.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm text-gray-700 block">E-Mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="praxis@example.de"
              required
              className="w-full rounded-lg border border-brand-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary bg-white"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-gray-700 block">Passwort</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              required
              className="w-full rounded-lg border border-brand-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary bg-white"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 whitespace-pre-line">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-white bg-brand-primary hover:bg-brand-accent transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Einloggen..." : "Login"}
          </button>
        </form>

        {/* Optional: kleiner Hinweis unten */}
        <p className="text-[13px] text-gray-400 text-center">
          Probleme beim Login?{" "}
          <span className="text-brand-primary">
            Wende dich an den Support.
          </span>
        </p>
      </div>
    </div>
  );
}
