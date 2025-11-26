// app/signup/page.tsx

type SignupPageProps = {
  searchParams: {
    session_id?: string;
  };
};

export default function SignupPage({ searchParams }: SignupPageProps) {
  const sessionId = searchParams.session_id;

  const hasSession = Boolean(sessionId);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="text-lg font-semibold tracking-tight">
            ReceptaAI
          </div>
          <a
            href="/login"
            className="text-sm text-zinc-300 hover:text-white underline-offset-4 hover:underline"
          >
            Login
          </a>
        </div>
      </header>

      <main className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-16">
        {hasSession ? (
          <>
            <h1 className="text-2xl font-semibold">Willkommen bei ReceptaAI 👋</h1>
            <p className="text-zinc-300">
              Vielen Dank für Ihren Kauf! Im nächsten Schritt legen Sie Ihren
              Zugang für das ReceptaAI-Dashboard an.
            </p>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-300">
              <p className="font-medium text-zinc-100">Technischer Hinweis</p>
              <p className="mt-1">
                Diese Seite ist bereits mit Ihrer Stripe-Bezahlung verknüpft
                (<span className="font-mono text-xs text-emerald-400">
                  session_id={sessionId}
                </span>
                ). In einem der nächsten Schritte verbinden wir hier automatisch
                Ihre Zahlung mit einem neuen Firmenkonto.
              </p>
            </div>
            <button
              className="mt-2 rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-900 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400"
            >
              Account-Erstellung (Platzhalter)
            </button>
            <p className="text-xs text-zinc-500">
              Der eigentliche Signup-/Onboarding-Flow wird in Phase „Stripe
              Billing Flow“ (Schritt C) implementiert.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold">Kein aktiver Checkout gefunden</h1>
            <p className="text-zinc-300">
              Diese Seite ist für Neukunden nach einem erfolgreichen Kauf über
              Stripe gedacht. Wir konnten keine gültige{" "}
              <code className="rounded bg-zinc-900 px-1 py-0.5 text-xs">
                session_id
              </code>{" "}
              in der URL finden.
            </p>
            <a
              href="/"
              className="mt-4 inline-flex rounded-md bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-700"
            >
              Zurück zur Startseite
            </a>
          </>
        )}
      </main>
    </div>
  );
}
