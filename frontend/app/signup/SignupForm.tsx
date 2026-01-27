// frontend/app/signup/SignupForm.tsx
"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type ApiError =
  | "missing_fields"
  | "subscription_lookup_failed"
  | "subscription_not_found"
  | "subscription_not_active"
  | "email_mismatch"
  | "subscription_already_linked"
  | "user_create_failed"
  | "subscription_link_failed"
  | string;

export default function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const sessionId = searchParams.get("session_id"); // string | null

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---------- Kein gültiger Checkout in der URL ----------
  if (!sessionId) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white shadow-md p-8 space-y-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <Image
              src="/branding/ReceptaAI-logo-horizontal-de.svg"
              alt="ReceptaAI"
              width={180}
              height={40}
            />
            <h1 className="text-xl font-semibold text-slate-900">
              Kein aktives ReceptaAI-Abo gefunden
            </h1>
            <p className="text-sm text-slate-600 max-w-sm">
              Diese Seite ist nur für neue Kund:innen nach einem erfolgreichen
              Kauf gedacht. Wir konnten keine gültige{" "}
              <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">
                session_id
              </code>{" "}
              in der URL finden.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="w-full inline-flex items-center justify-center rounded-lg bg-[#3B82F6] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2563EB] transition-colors"
          >
            Zur Startseite
          </button>
        </div>
      </main>
    );
  }

  function mapApiError(code: ApiError) {
    switch (code) {
      case "missing_fields":
        return "Bitte E-Mail und Passwort eingeben.";
      case "subscription_not_found":
        return "Zu dieser Stripe-Session wurde kein Stripe-Abo gefunden.";
      case "subscription_not_active":
        return "Dein Abo ist noch nicht aktiv. Bitte warte kurz oder versuche es erneut (Stripe kann 1–2 Minuten brauchen).";
      case "email_mismatch":
        return "Die E-Mail entspricht nicht der E-Mail aus dem Stripe-Kauf. Bitte die gleiche E-Mail verwenden.";
      case "subscription_already_linked":
        return "Dieses Stripe-Abo ist bereits mit einem Account verknüpft.";
      case "user_create_failed":
        return "Account konnte nicht erstellt werden. Bitte später noch einmal versuchen.";
      case "subscription_lookup_failed":
      case "subscription_link_failed":
        return "Serverfehler beim Verknüpfen deines Abos. Bitte später erneut versuchen.";
      default:
        return "Es ist ein Fehler beim Registrieren aufgetreten.";
    }
  }

  // ---------- Submit-Handler ----------
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          sessionId,
        }),
      });

      // robust: erst text lesen (falls 404/html etc), dann versuchen JSON zu parsen
      const raw = await res.text();
      const data = (() => {
        try {
          return raw ? JSON.parse(raw) : {};
        } catch {
          return {};
        }
      })() as any;

      if (!res.ok) {
        const code: ApiError = data?.error ?? "unknown";
        setError(mapApiError(code));
        // optional debug (kannst du später entfernen)
        console.error("[SIGNUP] api failed", res.status, code, raw);
        return;
      }

      // Auto-Login + Weiterleitung ins Onboarding
      const loginEmail = (data?.email ?? cleanEmail) as string;

      const { error: loginErr } = await supabaseBrowser.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (loginErr) {
        console.error("[SIGNUP] login error", loginErr);
        setError(
          "Der Account wurde erstellt, aber das automatische Login ist fehlgeschlagen. Bitte logge dich manuell ein."
        );
        return;
      }

      router.push("/onboarding");
    } catch (err) {
      console.error(err);
      setError("Unerwarteter Fehler. Bitte später noch einmal versuchen.");
    } finally {
      setLoading(false);
    }
  }

  // ---------- Normale Signup-UI ----------
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white shadow-md p-8 space-y-8">
        {/* Logo + Intro */}
        <div className="flex flex-col items-center gap-3 text-center">
          <Image
            src="/branding/ReceptaAI-logo-horizontal-de.svg"
            alt="ReceptaAI"
            width={180}
            height={40}
          />
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              ReceptaAI Konto erstellen
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Du hast dein Paket bereits über Stripe gebucht. Jetzt legst du
              dein Login für das Dashboard an.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              E-Mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Passwort
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="passwordRepeat" className="block text-sm font-medium text-slate-700">
              Passwort wiederholen
            </label>
            <input
              id="passwordRepeat"
              type="password"
              autoComplete="new-password"
              value={passwordRepeat}
              onChange={(e) => setPasswordRepeat(e.target.value)}
              minLength={6}
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
              required
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700 whitespace-pre-line">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center rounded-lg bg-[#3B82F6] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#2563EB] disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Konto wird erstellt …" : "Konto erstellen und fortfahren"}
          </button>
        </form>

        <p className="text-xs text-center text-slate-500">
          Mit deiner Registrierung akzeptierst du die Nutzungsbedingungen und
          Datenschutzhinweise von ReceptaAI.
        </p>
      </div>
    </main>
  );
}
