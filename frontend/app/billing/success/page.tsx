// app/billing/success/page.tsx
export default function BillingSuccessPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-xl shadow p-6 space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Vielen Dank! 🎉</h1>
        <p className="text-gray-700">
          Ihre Zahlung war erfolgreich. Ihr ReceptaAI-Abonnement wurde aktiviert.
        </p>
        <a
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Zurück zum Dashboard
        </a>
      </div>
    </main>
  );
}
