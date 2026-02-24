// app/billing/success/page.tsx

import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";

export default function BillingSuccessPage() {
  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-10">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <header>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Billing
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Zahlung erfolgreich 🎉
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Deine Zahlung wurde erfolgreich verarbeitet.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500">
              <CheckCircle2 className="h-4 w-4 text-white" />
            </div>
            <div className="space-y-2">
              <h2 className="text-base font-semibold text-slate-900">
                Willkommen bei ReceptaAI
              </h2>
              <p className="text-sm text-slate-600">
                Wenn du gerade ein neues Abo abgeschlossen hast, kannst du jetzt
                mit dem Setup starten. Prüfe auch deine E-Mails (Rechnung/Bestätigung).
              </p>
              <p className="text-xs text-slate-400">
                Falls du schon einen Account hast: einfach einloggen und weitermachen.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#3B82F6] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#2563EB]"
            >
              Zum Login
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-[#3B82F6] hover:text-[#3B82F6]"
            >
              Zur Startseite
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}