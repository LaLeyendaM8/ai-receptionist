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

        {/* 1 */}
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
                ReceptaAI richtet sich ausschließlich an Unternehmer (B2B).
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4 text-sm text-slate-600">
            <p>
              Diese Allgemeinen Geschäftsbedingungen gelten für alle Verträge
              zwischen ReceptaAI (nachfolgend „Anbieter“) und Unternehmern im
              Sinne von § 14 BGB (nachfolgend „Kunde“).
            </p>
            <p>
              Verbraucher im Sinne von § 13 BGB sind von der Nutzung ausgeschlossen.
            </p>
            <p>
              Abweichende oder ergänzende Bedingungen des Kunden werden nicht
              Vertragsbestandteil, es sei denn, ihrer Geltung wurde ausdrücklich
              schriftlich zugestimmt.
            </p>
          </div>
        </section>

        {/* 2 */}
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
                Cloudbasierte KI-Telefonassistenz (SaaS).
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4 text-sm text-slate-600">
            <p>
              ReceptaAI stellt eine cloudbasierte Software zur Verfügung, die
              automatisierte Telefonassistenz, Terminverwaltung und FAQ-Logik
              mittels KI-Technologie ermöglicht.
            </p>
            <p>
              Die durch ReceptaAI generierten Antworten erfolgen automatisiert
              auf Grundlage der vom Kunden bereitgestellten Daten und
              Systemkonfigurationen.
            </p>
            <p>
              Der Anbieter übernimmt keine Gewähr für die inhaltliche
              Richtigkeit, Vollständigkeit oder rechtliche Zulässigkeit
              automatisch erzeugter Antworten.
            </p>
            <p>
              Funktionsumfang, Limits und Leistungsgrenzen ergeben sich aus dem
              jeweils gebuchten Tarif.
            </p>
            <p>
              Der Anbieter ist berechtigt, die Software weiterzuentwickeln,
              sofern der vertragswesentliche Zweck nicht beeinträchtigt wird.
            </p>
          </div>
        </section>

        {/* 3 */}
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
                Abonnementbasierte Abrechnung.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4 text-sm text-slate-600">
            <p>
              Die Preise ergeben sich aus der jeweils gültigen Preisseite oder
              einem individuellen Angebot.
            </p>
            <p>
              Abonnements werden im Voraus abgerechnet und verlängern sich
              automatisch um die gebuchte Laufzeit, sofern sie nicht mit einer
              Frist von 14 Tagen zum Laufzeitende gekündigt werden.
            </p>
            <p>
              Der Anbieter ist berechtigt, Preise mit einer Ankündigungsfrist
              von mindestens 30 Tagen anzupassen.
            </p>
            <p>
              Bei Zahlungsverzug kann der Zugang zur Plattform vorübergehend
              gesperrt werden.
            </p>
          </div>
        </section>

        {/* 4 */}
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
                Rechtmäßige Nutzung & Einhaltung gesetzlicher Vorschriften.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3 text-sm text-slate-600">
            <p>
              Der Kunde ist verantwortlich für die Rechtmäßigkeit der Nutzung
              der Software sowie für die Einhaltung aller gesetzlichen
              Vorschriften, insbesondere Datenschutz- und Telekommunikationsrecht.
            </p>
            <p>
              Sofern Anrufe aufgezeichnet oder verarbeitet werden, ist der
              Kunde für die rechtliche Zulässigkeit und etwaige
              Informationspflichten gegenüber Anrufern verantwortlich.
            </p>
            <p>
              Zugangsdaten sind geheim zu halten. Missbrauch ist unverzüglich zu melden.
            </p>
          </div>
        </section>

        {/* 5 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            5. Drittanbieter & Infrastruktur
          </h2>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <p>
              Zur Erbringung der Leistungen nutzt ReceptaAI externe
              Infrastruktur- und API-Dienstleister (z.B. Telekommunikations-
              und KI-Anbieter).
            </p>
            <p>
              Der Anbieter übernimmt keine Haftung für Ausfälle,
              Verzögerungen oder Einschränkungen, die auf Drittanbieter
              zurückzuführen sind.
            </p>
          </div>
        </section>

        {/* 6 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            6. Haftung
          </h2>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <p>
              Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit
              sowie bei Verletzung von Leben, Körper oder Gesundheit.
            </p>
            <p>
              Bei einfacher Fahrlässigkeit haften wir nur bei Verletzung
              wesentlicher Vertragspflichten und begrenzt auf den
              typischerweise vorhersehbaren Schaden.
            </p>
            <p>
              Die Haftung ist – außer in Fällen von Vorsatz oder grober
              Fahrlässigkeit – der Höhe nach auf die im letzten
              Vertragsjahr gezahlten Gebühren begrenzt.
            </p>
          </div>
        </section>

        {/* 7 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            7. Schlussbestimmungen
          </h2>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <p>
              Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts.
            </p>
            <p>
              Gerichtsstand ist – soweit gesetzlich zulässig – der Sitz
              des Anbieters.
            </p>
            <p>
              Sollten einzelne Bestimmungen unwirksam sein, bleibt der
              Vertrag im Übrigen wirksam.
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