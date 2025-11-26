// app/billing/success/page.tsx

export default function BillingSuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-50">
      <div className="max-w-md rounded-lg border border-zinc-800 bg-zinc-900/60 px-6 py-8 text-center">
        <h1 className="text-2xl font-semibold">Zahlung erfolgreich 🎉</h1>
        <p className="mt-3 text-sm text-zinc-300">
          Ihre Zahlung wurde erfolgreich verarbeitet.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Wenn Sie gerade ein neues ReceptaAI-Abo abgeschlossen haben, prüfen
          Sie bitte Ihre E-Mails oder folgen Sie dem Link zur
          Account-Erstellung.
        </p>
        <a
          href="/"
          className="mt-5 inline-flex rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-emerald-400"
        >
          Zur Startseite
        </a>
      </div>
    </div>
  );
}
