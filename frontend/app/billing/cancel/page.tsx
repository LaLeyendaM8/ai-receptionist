// app/billing/cancel/page.tsx

export default function BillingCancelPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-50">
      <div className="max-w-md rounded-lg border border-zinc-800 bg-zinc-900/60 px-6 py-8 text-center">
        <h1 className="text-2xl font-semibold">Zahlung abgebrochen</h1>
        <p className="mt-3 text-sm text-zinc-300">
          Sie haben den Bezahlvorgang bei Stripe abgebrochen oder er konnte
          nicht abgeschlossen werden.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Sie können den Kauf jederzeit von der Startseite aus erneut starten.
        </p>
        <a
          href="/#pricing"
          className="mt-5 inline-flex rounded-md bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-700"
        >
          Zur Preisübersicht
        </a>
      </div>
    </div>
  );
}
