import { Brand } from "@/app/components/Brand"
import CopyNumber from "./_components/CopyNumber";

export const dynamic = "force-static";

const DEMO_NUMBER = "+4973198423975";
const TEL_LINK = `tel:${DEMO_NUMBER}`;

export default function DemoPage() {
  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#1E293B]">
      
      {/* Header */}
      <div className="border-b border-[#E2E8F0] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
           <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
                     <Brand href="#hero" variant="horizontal" size="lg" />
            </div>
            <div>
              <div className="text-sm font-semibold">ReceptaAI Demo</div>
              <div className="text-xs text-[#64748B]">
                Test-Beauty-Studio • 24/7 erreichbar
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="mx-auto max-w-3xl px-6 py-14 text-center">
        
        <h1 className="text-3xl font-semibold sm:text-4xl">
          Teste den ReceptaAI Telefonassistenten.
        </h1>

        <p className="mt-3 text-sm text-[#64748B]">
          Diese Demo simuliert ein Beauty-Studio. Ruf einfach an und erlebe,
          wie ReceptaAI Termine bucht und Fragen beantwortet.
        </p>

        {/* Big Number */}
        <div className="mt-8 text-2xl font-semibold text-[#3B82F6]">
          {DEMO_NUMBER}
        </div>

        {/* Big CTA */}
        <a
          href={TEL_LINK}
          className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-[#3B82F6] px-6 py-4 text-base font-semibold text-white shadow-md transition hover:bg-[#2563EB] sm:w-auto"
        >
          Jetzt Demo anrufen
        </a>

        {/* Copy Button */}
        <div className="mt-3 flex justify-center">
          <CopyNumber number={DEMO_NUMBER} />
        </div>

        {/* Speech Bubble */}
        <div className="mt-10 rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm text-left">
          
          <div className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
            Beispiel
          </div>

          <div className="mt-2 text-lg font-semibold">
            „Ich möchte einen Termin für einen Herrenhaarschnitt.“
          </div>

          <div className="mt-2 text-sm text-[#64748B]">
            Oder frage zum Beispiel:
          </div>

          <ul className="mt-3 text-sm text-[#64748B] space-y-1">
            <li>• „Habt ihr morgen noch einen Termin frei?“</li>
            <li>• „Was kostet ein Herrenhaarschnitt?“</li>
            <li>• „Wann habt ihr geöffnet?“</li>
          </ul>

        </div>

        {/* Info */}
        <div className="mt-10 rounded-2xl bg-[#3B82F6]/10 p-6">
          <p className="text-sm font-medium text-[#1E293B]">
            Diese Demo zeigt, wie ReceptaAI Anrufe für Friseure,
            Barbershops, Nagelstudios, Kosmetikstudios und Tattoo-Studios
            übernehmen kann.
          </p>

          <p className="mt-2 text-sm text-[#64748B]">
            Während du Kunden bedienst, nimmt ReceptaAI Anrufe an,
            beantwortet Fragen und bucht Termine automatisch.
          </p>
        </div>

        <p className="mt-8 text-xs text-[#94A3B8]">
          Hinweis: Dies ist eine Demo-Instanz („Test-Beauty-Studio“).
        </p>

        {/* NEW CTA */}
        <div className="mt-12 rounded-2xl bg-[#3B82F6] px-8 py-8 text-white shadow-md">

          <h2 className="text-xl font-semibold">
            Möchtest du ReceptaAI für deinen Salon nutzen?
          </h2>

          <p className="mt-2 text-sm text-blue-100">
            ReceptaAI nimmt Anrufe an, beantwortet Fragen und bucht Termine automatisch –
            perfekt für Friseure, Barbershops, Nagelstudios, Kosmetikstudios und Tattoo-Studios.
          </p>

          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">

            <a
              href="/"
              className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-semibold text-[#2563EB] transition hover:bg-slate-100"
            >
              Mehr über ReceptaAI erfahren
            </a>

            <a
              href={TEL_LINK}
              className="inline-flex items-center justify-center rounded-xl border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Demo nochmal anrufen
            </a>

          </div>

        </div>

      </div>
    </main>
  );
}