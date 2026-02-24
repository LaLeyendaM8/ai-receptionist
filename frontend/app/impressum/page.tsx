import { Building2, Mail, MapPin, Phone, Scale } from "lucide-react";

export default function ImpressumPage() {
  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-10">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {/* Header */}
        <header>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Rechtliches
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Impressum
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Angaben gemäß § 5 DDG (ehemals § 5 TMG) und § 18 Abs. 2 MStV.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#3B82F6]">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Anbieter
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Verantwortlich für den Inhalt dieser Website.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Geschäftsbezeichnung
              </p>
              <p className="mt-1 text-sm text-slate-900">
                ReceptaAI
              </p>

              <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">
                Inhaber
              </p>
              <p className="mt-1 text-sm text-slate-900">
                Michael F. E. Eraso Horn
              </p>

              <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">
                Rechtsform
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Einzelunternehmen
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 text-slate-400" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Anschrift
                  </p>
                  <p className="mt-1 text-sm text-slate-900">
                    Hafnerweg 19
                    <br />
                    89231 Neu-Ulm
                    <br />
                    Deutschland
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-start gap-2">
                <Phone className="mt-0.5 h-4 w-4 text-slate-400" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Telefon
                  </p>
                  <p className="mt-1 text-sm text-slate-900">
                    <a
                      href="tel:+491771572418"
                      className="text-[#3B82F6] hover:underline"
                    >
                      +49 177 1572418
                    </a>
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 text-slate-400" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    E-Mail
                  </p>
                  <p className="mt-1 text-sm text-slate-900">
                    <a
                      href="mailto:info@receptaai.de"
                      className="text-[#3B82F6] hover:underline"
                    >
                      info@receptaai.de
                    </a>
                  </p>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start gap-2">
                <Scale className="mt-0.5 h-4 w-4 text-slate-400" />
                <div className="space-y-4">

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Umsatzsteuer
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: –
                      <br />
                      (wird ergänzt, sobald vorhanden)
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Verantwortlich i.S.d. § 18 Abs. 2 MStV
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Michael F. E. Eraso Horn
                      <br />
                      Anschrift wie oben.
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Verbraucherstreitbeilegung
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Wir sind nicht verpflichtet und nicht bereit,
                      an Streitbeilegungsverfahren vor einer
                      Verbraucherschlichtungsstelle teilzunehmen.
                    </p>
                  </div>

                </div>
              </div>
            </div>

            <p className="md:col-span-2 text-xs text-slate-400">
              Stand: {new Date().toLocaleDateString("de-DE")}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}