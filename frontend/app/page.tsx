"use client";

import Link from "next/link";
import { useState } from "react";
import Image from "next/image";
import { Brand } from "./components/Brand";

type FaqItem = {
  question: string;
  answer: string;
};

const faqs: FaqItem[] = [
  {
    question: "Kann ReceptaAI Termine für meinen Salon oder mein Studio buchen?",
    answer:
      "Ja. ReceptaAI nimmt Anrufe entgegen, beantwortet typische Fragen und kann freie Termine direkt in deinen Kalender eintragen.",
  },
  {
    question: "Was passiert, wenn ein Kunde mit einer echten Person sprechen möchte?",
    answer:
      "In solchen Fällen kann ReceptaAI den Anruf an dein Team weiterleiten oder die Anfrage als HandOff erfassen, damit ihr gezielt zurückrufen könnt.",
  },
  {
    question: "Für welche Betriebe ist ReceptaAI geeignet?",
    answer:
      "ReceptaAI ist ideal für Friseure, Barbershops, Nagelstudios, Kosmetikstudios, Beauty Salons und Tattoo-Studios – also überall dort, wo viele Anrufe während laufender Kundentermine eingehen.",
  },
  {
    question: "Welche Anfragen kann ReceptaAI übernehmen?",
    answer:
      "Zum Beispiel Terminbuchungen, Rückfragen zu Öffnungszeiten, Preisen, Services, Verfügbarkeit oder allgemeine Standardfragen rund um euren Betrieb.",
  },
  {
    question: "Wie schnell ist die Einrichtung?",
    answer:
      "In der Regel seid ihr schnell startklar. Nach dem Onboarding kann ReceptaAI direkt für euren Betrieb eingerichtet und getestet werden.",
  },
];

export default function HomePage() {
  const [loading, setLoading] = useState<"faq_basic" | "starter" | null>(null);

async function startCheckout(plan: "faq_basic" | "starter") {
  try {
    setLoading(plan);

    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ plan }),
    });

    if (!res.ok) {
      console.error("checkout_failed", await res.json().catch(() => ({})));
      return;
    }

    const data = await res.json();

    if (data?.url) {
      window.location.href = data.url;
    } else {
      console.error("no_checkout_url_returned", data);
    }
  } catch (error) {
    console.error("checkout_error", error);
  } finally {
    setLoading(null);
  }
}

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* HEADER */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Brand href="#hero" variant="horizontal" size="lg" />

          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="/demo" className="hover:text-slate-900">
              Demo
            </a>
            <a href="#features" className="hover:text-slate-900">
              Features
            </a>
            <a href="#pricing" className="hover:text-slate-900">
              Preise
            </a>
            <a href="#faq" className="hover:text-slate-900">
              FAQ
            </a>
            <a
              href="/login"
              className="rounded-full border border-slate-200 px-4 py-1.5 text-sm text-slate-700 hover:border-blue-500 hover:text-blue-600"
            >
              Login
            </a>
          </nav>

          <a
            href="/login"
            className="inline-flex h-10 items-center rounded-full border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:border-blue-500 hover:text-blue-600 md:hidden"
          >
            Login
          </a>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section id="hero" className="bg-gradient-to-b from-sky-50 to-slate-50">
          <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-16 sm:px-6 md:grid md:grid-cols-2 md:items-center">
            {/* Left */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>Für Beauty Salons, Barbershops & Studios</span>
              </div>

              <div className="space-y-4">
                <h1 className="text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl lg:text-5xl">
                  Der KI-Telefonassistent für Beauty-Betriebe
                </h1>
                <p className="max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
                  Während du Kunden bedienst, nimmt ReceptaAI Anrufe an,
                  beantwortet Fragen und bucht Termine automatisch. So verpasst
                  dein Salon oder Studio keine Anfragen mehr.
                </p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <button
                  type="button"
            onClick={() => startCheckout("starter")}
            disabled={loading !== null}
                  className="inline-flex w-full items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-blue-700 disabled:opacity-70 sm:w-auto"
                >
                  {loading ? "Weiterleitung zu Stripe..." : "Jetzt starten"}
                </button>

                <a
                  href="/demo"
                  className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 hover:border-blue-500 hover:text-blue-600 sm:w-auto"
                >
                  Demo ansehen
                </a>
              </div>

              <div className="grid gap-3 text-xs text-slate-600 sm:grid-cols-2 sm:text-sm">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    24/7
                  </span>
                  <span>Erreichbar auch während Behandlungen</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    DSGVO
                  </span>
                  <span>DSGVO-konform entwickelt</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                    TERMINE
                  </span>
                  <span>Automatische Terminbuchung</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                    BEAUTY
                  </span>
                  <span>Für Friseur, Barber, Nails, Kosmetik & Tattoo</span>
                </div>
              </div>
            </div>

            {/* Right – Hero */}
            <div className="md:pl-8">
              <div className="relative">
                <div className="pointer-events-none absolute -inset-6 rounded-[32px] bg-blue-500/10 blur-2xl" />

                <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_50px_-30px_rgba(15,23,42,0.35)]">
                  <div className="relative aspect-video w-full">
                    <Image
                      src="/branding/HeroBild.png"
                      alt="ReceptaAI Dashboard & AI Call"
                      fill
                      className="object-cover"
                      priority
                    />

                    <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-white/70 to-transparent blur-[2px]" />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-blue-600/10 via-transparent to-emerald-500/10" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SO FUNKTIONIERT'S */}
        <section className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="text-center">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                So funktioniert&apos;s
              </h2>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                In 3 Schritten zu weniger verpassten Anrufen
              </p>
              <p className="mt-2 text-sm text-slate-600">
                ReceptaAI übernimmt den Telefonfluss in deinem Beauty-Betrieb –
                von der Begrüßung bis zur Terminbuchung.
              </p>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-xl">
                  📞
                </div>
                <h3 className="text-base font-semibold text-slate-900">
                  Anruf kommt rein
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Ein Kunde ruft an, während du gerade arbeitest. ReceptaAI geht
                  sofort ran – ohne Besetztzeichen und ohne verlorene Anfrage.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-xl">
                  🧠
                </div>
                <h3 className="text-base font-semibold text-slate-900">
                  KI versteht das Anliegen
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  ReceptaAI erkennt, ob es um einen Termin, Preise,
                  Öffnungszeiten, Services oder den Wunsch nach einem
                  Mitarbeiter geht.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-xl">
                  📅
                </div>
                <h3 className="text-base font-semibold text-slate-900">
                  Termin oder Weiterleitung
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Der Termin wird direkt eingetragen oder der Anruf bei Bedarf
                  an dein Team weitergegeben – strukturiert und ohne Chaos.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* VALUE / PAINPOINTS */}
        <section className="bg-slate-50">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="text-center">
              <p className="text-sm font-semibold text-blue-600">
                Mehr Erreichbarkeit, weniger Unterbrechung
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                Warum ReceptaAI perfekt für Beauty-Betriebe ist
              </h2>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-lg">
                  ✅
                </div>
                <h3 className="text-base font-semibold text-slate-900">
                  Keine verpassten Anrufe
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Wenn während einer Behandlung oder eines Kundentermins das
                  Telefon klingelt, geht ReceptaAI ran und sichert die Anfrage
                  trotzdem.
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-lg">
                  📅
                </div>
                <h3 className="text-base font-semibold text-slate-900">
                  Mehr gebuchte Termine
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Aus verpassten Anrufen werden echte Buchungen – auch dann,
                  wenn gerade niemand ans Telefon gehen kann.
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-lg">
                  ✂️
                </div>
                <h3 className="text-base font-semibold text-slate-900">
                  Weniger Unterbrechungen im Alltag
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Dein Team kann sich auf Kunden, Behandlungen und saubere
                  Abläufe konzentrieren, statt ständig aus dem Termin gerissen
                  zu werden.
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-lg">
                  ⭐
                </div>
                <h3 className="text-base font-semibold text-slate-900">
                  Professioneller erster Eindruck
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Jeder Anruf wird freundlich, klar und strukturiert
                  angenommen – auch in stressigen Stoßzeiten.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="text-center">
              <p className="text-sm font-semibold text-blue-600">
                Leistungsstarke Features
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                Alles, was dein Salon oder Studio für den Telefonalltag braucht
              </h2>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-lg">
                  🎙️
                </div>
                <h3 className="text-base font-semibold text-slate-900">
                  Telefon-KI für echte Anfragen
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  ReceptaAI erkennt Anliegen zuverlässig und führt Kunden durch
                  typische Gesprächssituationen am Telefon.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-lg">
                  📅
                </div>
                <h3 className="text-base font-semibold text-slate-900">
                  Direkte Terminbuchung
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Freie Zeiten werden erkannt und Termine direkt in euren
                  Kalender eingetragen – ohne manuelle Nacharbeit.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-lg">
                  💬
                </div>
                <h3 className="text-base font-semibold text-slate-900">
                  FAQ, Preise & Öffnungszeiten
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  ReceptaAI beantwortet wiederkehrende Fragen automatisch und
                  entlastet dein Team bei Standardanfragen.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-lg">
                  🔁
                </div>
                <h3 className="text-base font-semibold text-slate-900">
                  Weiterleitung & HandOffs
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Wenn nötig, wird an euer Team weitergeleitet oder eine
                  strukturierte Rückruf-Anfrage erstellt.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* TRUST BADGES */}
        <section className="bg-sky-50">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <div className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
              <div className="grid gap-6 text-sm text-slate-700 md:grid-cols-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-2xl bg-blue-100">
                    🔒
                  </div>
                  <div>
                    <p className="font-semibold">DSGVO-konform entwickelt</p>
                    <p className="text-xs text-slate-500">
                      Kundendaten werden nach klaren Datenschutzprinzipien
                      verarbeitet.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-2xl bg-blue-100">
                    🇪🇺
                  </div>
                  <div>
                    <p className="font-semibold">EU-Hosting</p>
                    <p className="text-xs text-slate-500">
                      Infrastruktur in Europa für einen professionellen
                      Datenschutzstandard.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-2xl bg-blue-100">
                    ⚖️
                  </div>
                  <div>
                    <p className="font-semibold">Für echte Betriebsabläufe</p>
                    <p className="text-xs text-slate-500">
                      Entwickelt für Studios und Salons mit laufendem
                      Kundengeschäft.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-2xl bg-blue-100">
                    📞
                  </div>
                  <div>
                    <p className="font-semibold">Telefonisch erreichbar</p>
                    <p className="text-xs text-slate-500">
                      Mehr Erreichbarkeit, ohne dass ständig jemand ans Telefon
                      muss.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PRICING */}
<section id="pricing" className="border-t border-slate-200 bg-white">
  <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
    <div className="text-center">
      <p className="text-sm font-semibold text-blue-600">
        Transparente Preise
      </p>
      <h2 className="mt-2 text-xl font-semibold text-slate-900">
        Wähle den passenden Plan für deinen Salon oder dein Studio
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Monatlich kündbar. Klare Preise für Beauty-Betriebe mit echten
        Telefonanfragen im Alltag.
      </p>
    </div>

    <div className="mt-10 grid gap-6 lg:grid-cols-2">
      {/* FAQ BASIC */}
      <div className="flex flex-col rounded-3xl border border-slate-200 bg-white p-8 shadow-md md:p-10">
        <div>
          <p className="text-sm font-semibold text-blue-600">FAQ Basic</p>

          <div className="mt-4 flex items-baseline gap-2">
            <p className="text-4xl font-semibold tracking-tight text-slate-900">
              79&nbsp;€
            </p>
            <span className="text-sm text-slate-500">/ Monat</span>
          </div>

          <p className="mt-2 text-sm text-slate-600">
            Für kleine Studios, die Anrufe professionell annehmen und häufige
            Fragen automatisch beantworten lassen wollen.
          </p>

          <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <span className="font-semibold text-slate-900">49 € Setup</span>
            <span className="mx-2 text-slate-300">•</span>
            <span>150 Gesprächsminuten inklusive</span>
            <span className="mx-2 text-slate-300">•</span>
            <span>danach 0,20 € / Minute</span>
          </div>

          <ul className="mt-6 space-y-2 text-sm text-slate-700">
            <li>• 1 Telefonnummer / Hauptleitung</li>
            <li>• Automatische Anrufannahme</li>
            <li>• Antworten auf Öffnungszeiten, Preise & Standardfragen</li>
            <li>• Weiterleitung bei Bedarf</li>
            <li>• Gesprächsübersicht & HandOffs</li>
            <li>• DSGVO-konformes Setup</li>
          </ul>
        </div>

        <div className="mt-8">
          <button
            type="button"
            onClick={() => startCheckout("faq_basic")}
            disabled={loading !== null}
            className="inline-flex w-full items-center justify-center rounded-full border border-blue-200 bg-white px-6 py-3 text-sm font-semibold text-blue-700 shadow-sm hover:border-blue-500 hover:bg-blue-50 disabled:opacity-70"
          >
            {loading === "faq_basic"
              ? "Weiterleitung zu Stripe..."
              : "FAQ Basic buchen"}
          </button>

          <p className="mt-3 text-center text-xs text-slate-500">
            Ideal, wenn du zuerst Anrufannahme und FAQ-Automatisierung willst.
          </p>
        </div>
      </div>

      {/* STARTER */}
      <div className="relative flex flex-col rounded-3xl border border-blue-200 bg-white p-8 shadow-lg md:p-10">
        <div className="absolute right-6 top-6 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
          Beliebtester Plan
        </div>

        <div>
          <p className="text-sm font-semibold text-blue-600">Starter</p>

          <div className="mt-4 flex items-baseline gap-2">
            <p className="text-4xl font-semibold tracking-tight text-slate-900">
              149&nbsp;€
            </p>
            <span className="text-sm text-slate-500">/ Monat</span>
          </div>

          <p className="mt-2 text-sm text-slate-600">
            Der vollständige KI-Telefonassistent für Beauty-Betriebe mit
            Terminbuchung und automatisierter Kundenannahme.
          </p>

          <div className="mt-4 rounded-2xl bg-blue-50 px-4 py-3 text-sm text-slate-700">
            <span className="font-semibold text-slate-900">99 € Setup</span>
            <span className="mx-2 text-slate-300">•</span>
            <span>300 Gesprächsminuten inklusive</span>
            <span className="mx-2 text-slate-300">•</span>
            <span>danach 0,20 € / Minute</span>
          </div>

          <ul className="mt-6 space-y-2 text-sm text-slate-700">
            <li>• 1 Telefonnummer / Hauptleitung</li>
            <li>• Automatische Anrufannahme</li>
            <li>• Terminbuchung in den Kalender</li>
            <li>• Antworten auf Öffnungszeiten, Preise & Standardfragen</li>
            <li>• Weiterleitung bei Bedarf</li>
            <li>• Gesprächsübersicht & HandOffs</li>
            <li>• DSGVO-konformes Setup</li>
          </ul>
        </div>

        <div className="mt-8">
          <button
            type="button"
            onClick={() => startCheckout("starter")}
            disabled={loading !== null}
            className="inline-flex w-full items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-blue-700 disabled:opacity-70"
          >
            {loading === "starter"
              ? "Weiterleitung zu Stripe..."
              : "Starter buchen"}
          </button>

          <p className="mt-3 text-center text-xs text-slate-500">
            Für Salons und Studios, die Termine direkt telefonisch buchen lassen
            wollen.
          </p>
        </div>
      </div>
    </div>
  </div>
</section>

        {/* FAQ */}
        <section id="faq" className="bg-slate-50">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="text-center">
              <p className="text-sm font-semibold text-blue-600">
                Häufig gestellte Fragen
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                Alles, was du über ReceptaAI wissen musst
              </h2>
            </div>

            <div className="mt-8 space-y-4">
              {faqs.map((item) => (
                <details
                  key={item.question}
                  className="group rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                    <span className="font-medium text-slate-900">
                      {item.question}
                    </span>
                    <span className="text-xs text-slate-400 group-open:hidden">
                      +
                    </span>
                    <span className="hidden text-xs text-slate-400 group-open:inline">
                      −
                    </span>
                  </summary>
                  <p className="mt-2 text-sm text-slate-600">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* BOTTOM CTA */}
        <section className="bg-gradient-to-r from-sky-700 to-blue-700 text-white">
          <div className="mx-auto max-w-6xl px-4 py-14 text-center sm:px-6">
            <p className="text-sm font-semibold uppercase tracking-wide">
              Bereit für weniger verpasste Anrufe?
            </p>
            <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">
              Starte mit ReceptaAI und mache deinen Salon telefonisch
              professionell erreichbar.
            </h2>
            <p className="mt-3 text-sm text-sky-100">
              Für Friseure, Barber, Nails, Kosmetik und Tattoo-Studios.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <button
                type="button"
            onClick={() => startCheckout("starter")}
            disabled={loading !== null}
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-blue-700 shadow-md hover:bg-slate-100 disabled:opacity-70"
              >
                {loading ? "Weiterleitung zu Stripe..." : "Jetzt starten"}
              </button>
              <a
                href="/demo"
                className="text-sm font-medium text-sky-100 underline-offset-4 hover:underline"
              >
                Erst die Demo ansehen
              </a>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
            <div className="grid gap-8 md:grid-cols-4">
              <div className="space-y-3">
                <Brand href="/" variant="horizontal" size="md" />
                <p className="text-sm text-slate-600">
                  Dein KI-Telefonassistent für Beauty-Betriebe – damit kein
                  wichtiger Anruf und kein potenzieller Termin mehr verloren
                  geht.
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <p className="font-semibold text-slate-900">Produkt</p>
                <a
                  href="#features"
                  className="block text-slate-600 hover:text-slate-900"
                >
                  Features
                </a>
                <a
                  href="#pricing"
                  className="block text-slate-600 hover:text-slate-900"
                >
                  Preise
                </a>
                <a
                  href="#faq"
                  className="block text-slate-600 hover:text-slate-900"
                >
                  FAQ
                </a>
                <Link
                  href="/login"
                  className="block text-slate-600 hover:text-slate-900"
                >
                  Login
                </Link>
              </div>

              <div className="space-y-2 text-sm">
                <p className="font-semibold text-slate-900">Rechtliches</p>
                <Link
                  href="/impressum"
                  className="block text-slate-600 hover:text-slate-900"
                >
                  Impressum
                </Link>
                <Link
                  href="/datenschutz"
                  className="block text-slate-600 hover:text-slate-900"
                >
                  Datenschutz
                </Link>
                <Link
                  href="/agb"
                  className="block text-slate-600 hover:text-slate-900"
                >
                  AGB (B2B)
                </Link>
                <Link
                  href="/kontakt"
                  className="block text-slate-600 hover:text-slate-900"
                >
                  Kontakt
                </Link>
              </div>

              <div className="space-y-2 text-sm">
                <p className="font-semibold text-slate-900">Kontakt</p>
                <p className="text-slate-600">Michael F. E. Eraso Horn</p>
                <a
                  className="block text-slate-600 hover:text-slate-900"
                  href="mailto:info@receptaai.de"
                >
                  info@receptaai.de
                </a>
                <a
                  className="block text-slate-600 hover:text-slate-900"
                  href="tel:+491771572418"
                >
                  +49 177 1572418
                </a>
                <p className="text-slate-600">Neu-Ulm, Deutschland</p>
              </div>
            </div>

            <div className="mt-8 border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
              © {new Date().getFullYear()} ReceptaAI. Alle Rechte vorbehalten.
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}