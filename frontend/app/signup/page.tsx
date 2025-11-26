"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

// ⬇️ Ganz wichtig: KEIN revalidatePath, KEIN revalidate als Funktion
export const dynamic = "force-dynamic";
export const revalidate = 0; // diese Page wird nie statisch gecacht

type SignupError =
  | "subscription_not_found"
  | "email_mismatch"
  | "subscription_already_linked"
  | "user_create_failed"
  | "subscription_link_failed";

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id") ?? "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ❗ Wenn keine Session-ID in der URL ist, Hinweis anzeigen
  if (!sessionId) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow px-6 py-8 space-y-4">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">
            Kein aktiver Checkout gefunden
          </h1>
          <p className="text-sm text-gray-600">
            Diese Seite ist nur für neue Kund:innen nach einem erfolgreichen
            Kauf über Stripe gedacht. Wir konnten keine gültige{" "}
            <code>session_id</code> in der URL finden.
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
    setLoading(true);
    setError(null);

    if (!email || !password) {
      setError("Bitte E-Mail und Passwort eingeben.");
      setLoading(false);
      return;
    }

    if (password !== passwordRepeat) {
      setError("Die Passwörter stimmen nicht überein.");
      setLoading(false);
      return;
    }

    try {
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

      const data = (await res.json().catch(() => ({}))) as {
        error?: SignupError;
      };

      if (!res.ok) {
        switch (data.error) {
          case "subscription_not_found":
            setError("Zu dieser Session wurde kein Stripe-Abo gefunden.");
            break;
          case "email_mismatch":
            setError(
              "Die E-Mail entspricht nicht der E-Mail aus dem Stripe-Kauf. Bitte die gleiche E-Mail verwenden."
            );
            break;
          case "subscription_already_linked":
            setError("Dieses Stripe-Abo ist bereits mit einem Account verknüpft.");
            break;
          case "user_create_failed":
            setError("Account konnte nicht erstellt werden. Bitte später noch einmal versuchen.");
            break;
          case "subscription_link_failed":
            setError(
              "Der Stripe-Eintrag konnte nicht mit deinem Account verknüpft werden. Bitte später noch einmal versuchen."
            );
            break;
          default:
            setError("Es ist ein Fehler beim Registrieren aufgetreten.");
        }
        return;
      }

      // ✅ Signup erfolgreich – direkt ins Onboarding weiterleiten
      router.push("/onboarding");
    } catch (err) {
      console.error("signup_unexpected_error", err);
      setError("Unerwarteter Fehler. Bitte später noch einmal versuchen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow px-6 py-8 space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-gray-900">
            ReceptaAI Konto erstellen
          </h1>
          <p className="text-sm text-gray-600">
            Du hast dein Paket bereits über Stripe gebucht. Jetzt legst du dein
            Login für das Dashboard an.
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

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
              minLength={6}
              required
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
              minLength={6}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Account wird erstellt..." : "Konto erstellen & weiter"}
          </button>
        </form>
      </div>
    </main>
  );
}
