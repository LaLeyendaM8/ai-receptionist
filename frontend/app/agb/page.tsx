import { FileText, ShieldCheck, CreditCard, AlertTriangle } from "lucide-react";

export default function AGBPage() {
  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-10">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Rechtliches
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">AGB</h1>
          <p className="mt-2 text-sm text-slate-500">
            Allgemeine Geschäftsbedingungen für ReceptaAI (B2B).
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#3B82F6]">
              <FileText className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                1. Geltungsbereich
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Diese AGB gelten für Unternehmer im Sinne von § 14 BGB.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4 text-sm text-slate-600">
            <p>
              Diese Allgemeinen Geschäftsbedingungen gelten für alle Verträge
              zwischen ReceptaAI und Kunden, die Unternehmer (B2B) sind. Abweichende
              Bedingungen des Kunden gelten nur, wenn wir ihnen ausdrücklich
              schriftlich zustimmen.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                2. Leistungen
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                SaaS-Service für KI-Telefonassistenz, Terminlogik &amp; FAQs.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4 text-sm text-slate-600">
            <p>
              ReceptaAI stellt eine webbasierte Software (SaaS) zur Verfügung.
              Funktionsumfang und ggf. Limits ergeben sich aus dem gebuchten Plan.
            </p>
            <p>
              Wir entwickeln das Produkt kontinuierlich weiter. Änderungen, die
              den Kernzweck nicht beeinträchtigen, sind zulässig.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#3B82F6]">
              <CreditCard className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                3. Preise, Zahlung, Laufzeit
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Abrechnung nach Plan (monatlich/jährlich), sofern angeboten.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4 text-sm text-slate-600">
            <p>
              Preise ergeben sich aus der jeweils gültigen Preisseite bzw. dem
              Angebot. Zahlungen erfolgen im Voraus, sofern nicht anders
              vereinbart.
            </p>
            <p>
              Abonnements verlängern sich automatisch um die gebuchte Laufzeit,
              sofern nicht rechtzeitig gekündigt wird (Details gemäß Billing-Flow).
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500">
              <AlertTriangle className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                4. Pflichten des Kunden
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Rechtmäßige Nutzung, korrekte Daten, Zugangsdaten schützen.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3 text-sm text-slate-600">
            <p>
              Der Kunde ist verantwortlich für die Inhalte und Daten, die er in
              ReceptaAI speichert oder verarbeiten lässt, sowie für die Einhaltung
              aller gesetzlichen Pflichten (insb. Datenschutz/Telekommunikation).
            </p>
            <p>
              Zugangsdaten sind geheim zu halten. Missbrauch ist unverzüglich zu melden.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            5. Verfügbarkeit, Support, Wartung
          </h2>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <p>
              Wir bemühen uns um eine hohe Verfügbarkeit, können jedoch keine
              durchgehende, unterbrechungsfreie Verfügbarkeit garantieren.
              Wartungen und Updates können zu kurzzeitigen Einschränkungen führen.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            6. Haftung
          </h2>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <p>
              Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie
              bei Verletzung von Leben, Körper oder Gesundheit.
            </p>
            <p>
              Bei einfacher Fahrlässigkeit haften wir nur bei Verletzung wesentlicher
              Vertragspflichten (Kardinalpflichten) und begrenzt auf den typischerweise
              vorhersehbaren Schaden.
            </p>
            <p className="text-xs text-slate-400">
              Hinweis: Diese Vorlage ersetzt keine Rechtsberatung. Für Launch &amp; Scale
              ggf. einmalig vom Juristen prüfen lassen.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            7. Schlussbestimmungen
          </h2>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <p>
              Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts.
              Gerichtsstand ist – soweit zulässig – der Sitz des Anbieters.
            </p>
            <p>
              Sollten einzelne Bestimmungen unwirksam sein, bleibt der Vertrag im
              Übrigen wirksam.
            </p>
          </div>
        </section>

        <p className="text-xs text-slate-400">
          Stand: {new Date().toLocaleDateString("de-DE")}
        </p>
      </div>
    </main>
  );
}
