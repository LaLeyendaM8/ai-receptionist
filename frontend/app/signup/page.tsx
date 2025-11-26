"use client";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";



export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id") ?? "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ❌ Kein gültiger Checkout in der URL
  if (!sessionId) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow p-6 space-y-4">
          <h1 className="text-xl font-semibold text-gray-900">
            Kein aktiver Checkout gefunden
          </h1>
          <p className="text-sm text-gray-600">
            Diese Seite ist nur für neue Kund:innen nach einem erfolgreichen Kauf
            über Stripe gedacht. Wir konnten keine gültige <code>session_id</code>{" "}
            in der URL finden.
          </p>
          <button
            onClick={() => router.push("/")}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Zur Startseite
          </button>
        </div>
      </main>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Bitte E-Mail und Passwort eingeben.");
      return;
    }

    if (password !== passwordRepeat) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          sessionId,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Fehlercodes aus der Route hübsch übersetzen
        switch (data?.error) {
          case "subscription_not_found":
            setError("Zu dieser Session wurde kein Stripe-Abo gefunden.");
            break;
          case "email_mismatch":
            setError(
              "Die E-Mail entspricht nicht der E-Mail aus dem Stripe-Kauf. Bitte die gleiche E-Mail verwenden wie beim Bezahlen."
            );
            break;
          case "subscription_already_linked":
            setError(
              "Dieses Stripe-Abo ist bereits mit einem Account verknüpft."
            );
            break;
          case "user_create_failed":
            setError(
              "Account konnte nicht erstellt werden. Bitte später noch einmal versuchen."
            );
            break;
          default:
            setError("Es ist ein Fehler beim Registrieren aufgetreten.");
        }
        return;
      }

      // ✅ Signup erfolgreich – weiter ins Onboarding
      router.push("/onboarding");
    } catch (err) {
      console.error(err);
      setError("Unerwarteter Fehler. Bitte später noch einmal versuchen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow p-6 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-gray-900">
            ReceptaAI Konto erstellen
          </h1>
          <p className="text-sm text-gray-600">
            Du hast dein Paket bereits über Stripe gebucht. Jetzt legst du dein
            Login für das Dashboard an.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              E-Mail
            </label>
            <input
              type="email"
              autoComplete="email"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Passwort
            </label>
            <input
              type="password"
              autoComplete="new-password"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Passwort wiederholen
            </label>
            <input
              type="password"
              autoComplete="new-password"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={passwordRepeat}
              onChange={(e) => setPasswordRepeat(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 whitespace-pre-line">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Account wird erstellt..." : "Account erstellen"}
          </button>

          <p className="text-xs text-gray-500">
            Hinweis: Dieses Signup funktioniert nur direkt nach einem
            erfolgreichen Stripe-Checkout.
          </p>
        </form>
      </div>
    </main>
  );
}
