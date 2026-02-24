import {
  Shield,
  Mail,
  MapPin,
  Database,
  Cookie,
  Users,
  Lock,
} from "lucide-react";

export default function DatenschutzPage() {
  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-10">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Rechtliches
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Datenschutzerklärung
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Informationen zur Verarbeitung personenbezogener Daten gemäß DSGVO (B2B).
          </p>
        </header>

        {/* Verantwortlicher */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#3B82F6]">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Verantwortlicher
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Verantwortlich für die Datenverarbeitung auf dieser Website.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4 text-sm text-slate-600">
            <p className="text-slate-900 font-medium">ReceptaAI</p>
            <p>Inhaber: Michael F. E. Eraso Horn</p>
            <p>
              Hafnerweg 19<br />
              89231 Neu-Ulm<br />
              Deutschland
            </p>
            <p>
              E-Mail:{" "}
              <a
                href="mailto:info@receptaai.de"
                className="text-[#3B82F6] hover:underline"
              >
                info@receptaai.de
              </a>
            </p>
          </div>
        </section>

        {/* Server Logs */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500">
              <Database className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Zugriffsdaten / Server-Logs
              </h2>
            </div>
          </div>

          <div className="mt-6 space-y-3 text-sm text-slate-600">
            <p>
              Beim Besuch unserer Website werden automatisch Informationen
              durch unseren Hosting-Provider erfasst (z. B. IP-Adresse,
              Datum/Uhrzeit, aufgerufene Seite, Browsertyp).
            </p>
            <p>
              Diese Daten dienen der technischen Bereitstellung und Sicherheit
              der Website.
            </p>
            <p>
              Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse).
            </p>
          </div>
        </section>

        {/* Cookies */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#3B82F6]">
              <Cookie className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Cookies
              </h2>
            </div>
          </div>

          <div className="mt-6 space-y-3 text-sm text-slate-600">
            <p>
              Wir verwenden ausschließlich technisch notwendige Cookies
              (z. B. für Login-Session).
            </p>
            <p>
              Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO i.V.m. § 25 Abs. 2 TTDSG.
            </p>
          </div>
        </section>

        {/* SaaS / Auftragsverarbeitung */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500">
              <Users className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                SaaS-Dienst / Auftragsverarbeitung
              </h2>
            </div>
          </div>

          <div className="mt-6 space-y-3 text-sm text-slate-600">
            <p>
              ReceptaAI richtet sich an Unternehmen. Unsere Kunden können
              personenbezogene Daten ihrer Endkunden (z. B. Name,
              Telefonnummer, Termindaten) verarbeiten.
            </p>
            <p>
              In diesen Fällen verarbeiten wir diese Daten ausschließlich
              als Auftragsverarbeiter gemäß Art. 28 DSGVO im Auftrag
              unseres jeweiligen Kunden.
            </p>
            <p>
              Der jeweilige Geschäftskunde bleibt Verantwortlicher im
              Sinne der DSGVO.
            </p>
          </div>
        </section>

        {/* KI & Telefonie */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            KI-gestützte Telefonverarbeitung
          </h2>

          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <p>
              Unser Dienst nutzt KI-Technologien zur automatisierten
              Verarbeitung von Anrufen und Anfragen.
            </p>
            <p>
              Dabei können Gesprächsinhalte, Telefonnummern und
              Terminangaben verarbeitet werden.
            </p>
            <p>
              Die Verarbeitung erfolgt entweder im Rahmen einer
              Auftragsverarbeitung oder auf Grundlage berechtigter
              Interessen des Kunden.
            </p>
          </div>
        </section>

        {/* Drittanbieter */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Eingesetzte Dienstleister
          </h2>

          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <p>
              Zur Bereitstellung unseres Dienstes nutzen wir externe
              Infrastruktur- und API-Anbieter (z. B. Hosting, KI-Services,
              Telekommunikationsanbieter).
            </p>
            <p>
              Dabei kann eine Datenübermittlung in Drittländer erfolgen.
              In diesen Fällen erfolgt die Übermittlung auf Grundlage
              geeigneter Garantien (z. B. EU-Standardvertragsklauseln).
            </p>
          </div>
        </section>

        {/* Speicherdauer */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Speicherdauer
          </h2>

          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <p>
              Personenbezogene Daten werden nur so lange gespeichert,
              wie dies für die jeweiligen Zwecke erforderlich ist oder
              gesetzliche Aufbewahrungspflichten bestehen.
            </p>
          </div>
        </section>

        {/* Rechte */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#3B82F6]">
              <Lock className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Betroffenenrechte
              </h2>
            </div>
          </div>

          <div className="mt-6 space-y-3 text-sm text-slate-600">
            <p>
              Betroffene haben das Recht auf Auskunft, Berichtigung,
              Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit
              sowie Widerspruch.
            </p>
            <p>
              Zudem besteht ein Beschwerderecht bei einer zuständigen
              Datenschutzaufsichtsbehörde.
            </p>
            <p className="text-xs text-slate-400">
              Wenn Sie Endkunde eines unserer Geschäftskunden sind,
              wenden Sie sich bitte zunächst an das jeweilige Unternehmen.
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