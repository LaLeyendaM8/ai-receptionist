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
            Informationen zur Verarbeitung personenbezogener Daten gemäß DSGVO
            (B2B).
          </p>
        </header>

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
                Wer entscheidet über Zwecke und Mittel der Verarbeitung.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Anbieter
              </p>
              <p className="mt-1 text-sm text-slate-900">ReceptaAI</p>

              <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">
                Inhaber
              </p>
              <p className="mt-1 text-sm text-slate-900">
                Michael F. E. Eraso Horn
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
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

              <div className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 text-slate-400" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Kontakt
                  </p>
                  <p className="mt-1 text-sm">
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
              <h3 className="text-sm font-semibold text-slate-900">
                Überblick (kurz)
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li>
                  • Wir verarbeiten Daten zur Bereitstellung unserer Website und
                  unseres SaaS-Dienstes (B2B).
                </li>
                <li>
                  • Bei Kontaktanfragen verarbeiten wir deine Angaben zur
                  Bearbeitung der Anfrage.
                </li>
                <li>
                  • Im Produkt werden je nach Nutzung u. a. Anruf-/Termin- und
                  Konfigurationsdaten verarbeitet (im Auftrag unserer Kunden).
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Website / Server Logs */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500">
              <Database className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Zugriffsdaten / Server-Logs
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Technisch notwendige Daten bei Aufruf der Website.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3 text-sm text-slate-600">
            <p>
              Beim Aufruf unserer Website werden durch den Hosting-Provider
              automatisch Informationen erfasst (z. B. IP-Adresse in gekürzter/
              pseudonymisierter Form, Datum/Uhrzeit, aufgerufene Seite, User-Agent,
              Referrer). Die Verarbeitung erfolgt zur{" "}
              <span className="text-slate-900">
                Gewährleistung von Stabilität und Sicherheit
              </span>{" "}
              der Website.
            </p>
            <p>
              <span className="text-slate-900 font-medium">Rechtsgrundlage:</span>{" "}
              Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse).
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
                Cookies & lokale Speicherung
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Session-/Login-Funktionen, ggf. notwendige Cookies.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3 text-sm text-slate-600">
            <p>
              Wir verwenden Cookies bzw. ähnliche Technologien, soweit sie für
              den Betrieb der Website und des Logins notwendig sind (z. B.
              Session-Cookies).
            </p>
            <p>
              <span className="text-slate-900 font-medium">Rechtsgrundlage:</span>{" "}
              Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse) bzw. § 25 Abs. 2
              TTDSG (technisch erforderlich).
            </p>
          </div>
        </section>

        {/* SaaS / Daten im Auftrag */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500">
              <Users className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Daten im SaaS (B2B) / Auftragsverarbeitung
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Wenn unsere Kunden personenbezogene Daten ihrer Endkunden
                verarbeiten.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3 text-sm text-slate-600">
            <p>
              Unser Dienst richtet sich an Unternehmen. Unsere Kunden können in
              ReceptaAI z. B. Kontakt- oder Termindaten ihrer Endkunden
              verarbeiten. In diesen Fällen verarbeiten wir diese Daten{" "}
              <span className="text-slate-900">
                als Auftragsverarbeiter
              </span>{" "}
              im Auftrag des Kunden.
            </p>
            <p>
              <span className="text-slate-900 font-medium">Rechtsgrundlage:</span>{" "}
              Art. 28 DSGVO (Auftragsverarbeitung) sowie der Vertrag mit dem Kunden.
            </p>
          </div>
        </section>

        {/* Sicherheitsmaßnahmen / Rechte */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#3B82F6]">
              <Lock className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Betroffenenrechte & Sicherheit
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Auskunft, Löschung, Berichtigung &amp; Co.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3 text-sm text-slate-600">
            <p>
              Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung
              der Verarbeitung, Datenübertragbarkeit sowie Widerspruch, soweit
              die gesetzlichen Voraussetzungen vorliegen.
            </p>
            <p>
              Außerdem besteht ein Beschwerderecht bei einer Datenschutzaufsichtsbehörde.
            </p>
            <p className="text-xs text-slate-400">
              Hinweis: Wenn du Endkunde eines unserer Geschäftskunden bist, wende dich
              bitte primär an das Unternehmen, bei dem du Kunde bist, da dieses
              in der Regel Verantwortlicher ist.
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
