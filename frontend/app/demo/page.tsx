import Image from "next/image";
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
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#3B82F6]/10">
              <Image
                src="/branding/ReceptaAI-logo-icon.svg"
                alt="ReceptaAI"
                width={26}
                height={26}
              />
            </div>
            <div>
              <div className="text-sm font-semibold">ReceptaAI Demo</div>
              <div className="text-xs text-[#64748B]">
                Testrestaurant • 24/7 erreichbar
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="mx-auto max-w-3xl px-6 py-14 text-center">
        <h1 className="text-3xl font-semibold sm:text-4xl">
          Erlebe ReceptaAI live.
        </h1>

        <p className="mt-3 text-sm text-[#64748B]">
          Ruf das Testrestaurant an und teste die KI selbst.
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
          Jetzt anrufen
        </a>

        {/* Copy Button */}
        <div className="mt-3 flex justify-center">
          <CopyNumber number={DEMO_NUMBER} />
        </div>

        {/* Speech Bubble */}
        <div className="mt-10 rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm text-left">
          <div className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
            Sag einfach
          </div>

          <div className="mt-2 text-lg font-semibold">
            „Ich will einen Tisch reservieren.“
          </div>

          <div className="mt-2 text-sm text-[#64748B]">
            Zum Beispiel: „Heute 19 Uhr, 2 Personen.“
          </div>
        </div>

        <p className="mt-8 text-xs text-[#94A3B8]">
          Hinweis: Dies ist eine Demo-Instanz („Testrestaurant“).
        </p>
      </div>
    </main>
  );
}