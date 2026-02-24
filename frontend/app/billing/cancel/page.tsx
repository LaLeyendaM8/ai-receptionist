// app/billing/cancel/page.tsx

import Link from "next/link";
import { XCircle, ArrowLeft } from "lucide-react";

export default function BillingCancelPage() {
  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-10">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <header>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Billing
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Zahlung abgebrochen
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Du hast den Bezahlvorgang bei Stripe abgebrochen oder er konnte nicht
            abgeschlossen werden.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500">
              <XCircle className="h-4 w-4 text-white" />
            </div>
            <div className="space-y-2">
              <h2 className="text-base font-semibold text-slate-900">
                Kein Problem
              </h2>
              <p className="text-sm text-slate-600">
                Du kannst den Kauf jederzeit erneut starten – entweder über die
                Preisübersicht oder direkt auf der Startseite.
              </p>
              <p className="text-xs text-slate-400">
                Tipp: Falls Stripe dich zurückgeworfen hat, prüfe kurz Pop-up-/Redirect-Blocker
                oder versuche es im Inkognito-Fenster.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/#pricing"
              className="inline-flex items-center justify-center rounded-xl bg-[#3B82F6] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#2563EB]"
            >
              Zur Preisübersicht
            </Link>

            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-[#3B82F6] hover:text-[#3B82F6]"
            >
              <ArrowLeft className="h-4 w-4" />
              Zur Startseite
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}