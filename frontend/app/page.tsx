"use client";
import Link from "next/link";
import { useState } from "react";
import Image from "next/image";
import { Brand } from "./components/Brand"

type FaqItem = {
  question: string;
  answer: string;
};

const faqs: FaqItem[] = [
  {
    question: "Können Kunden mit einer echten Person sprechen?",
    answer:
      "Ja. In Spezialfällen kann ReceptaAI Anrufe an dein Team weiterleiten, damit eine echte Person übernimmt.",
  },
  {
    question: "Was passiert bei Spezialfällen?",
    answer:
      "Die KI erkennt komplexe Anfragen und leitet diese an die zuständige Person weiter. Alle Gespräche werden protokolliert, damit dein Team optimal vorbereitet ist.",
  },
  {
    question: "Wie schnell ist die Einrichtung?",
    answer:
      "In der Regel bist du in weniger als einer Stunde startklar – nach dem Onboarding kann ReceptaAI direkt Anrufe entgegennehmen.",
  },
  {
    question: "Welche Sprachen werden unterstützt?",
    answer:
      "Standardmäßig Deutsch und Englisch. Optional können weitere Sprachen wie Türkisch oder Spanisch ergänzt werden.",
  },
  {
    question: "Kann ich den Service testen?",
    answer:
      "Aktuell gibt es ein flexibles Monatsabo ohne lange Bindung. So kannst du ReceptaAI in deinem Alltag ausprobieren.",
  },
];

export default function HomePage() {
  const [loading, setLoading] = useState(false);

  async function startCheckout() {
    try {
      setLoading(true);
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
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
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* HEADER */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">

  <Brand href="#hero" variant="horizontal" size="md" />


          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
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

          {/* Mobile: nur Login */}
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
        <section
          id="hero"
          className="bg-gradient-to-b from-sky-50 to-slate-50"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-16 sm:px-6 md:grid md:grid-cols-2 md:items-center">
            {/* Left */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>KI-Telefon für dein Business</span>
              </div>

              <div className="space-y-4">
                <h1 className="text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl lg:text-5xl">
                  ReceptaAI – dein KI-Telefonassistent
                </h1>
                <p className="max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
                  Nimmt Anrufe entgegen, beantwortet Fragen und bucht Termine –
                  24/7, DSGVO-konform und mehrsprachig. Damit kein wichtiger
                  Anruf mehr verloren geht.
                </p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={startCheckout}
                  disabled={loading}
                 className="inline-flex w-full items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-blue-700 disabled:opacity-70 sm:w-auto"
                >
                  {loading ? "Weiterleitung zu Stripe..." : "Jetzt starten"}
                </button>

               <a
  href="#features"
  className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 hover:border-blue-500 hover:text-blue-600 sm:w-auto"
>
                  Mehr über Features
                </a>
              </div>

              <div className="grid gap-3 text-xs text-slate-600 sm:grid-cols-2 sm:text-sm">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    EU
                  </span>
                  <span>Gehostet in der EU</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    DSGVO
                  </span>
                  <span>DSGVO-konform</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                    DE / EN
                  </span>
                  <span>Mehrsprachige Betreuung</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                    KMU
                  </span>
                  <span>Für Dienstleister & Praxen</span>
                </div>
              </div>
            </div>

            {/* Right – Hero Placeholder */}
<div className="md:pl-8">
  <div className="relative">
    {/* Glow */}
    <div className="pointer-events-none absolute -inset-6 rounded-[32px] bg-blue-500/10 blur-2xl" />

    {/* Card */}
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_50px_-30px_rgba(15,23,42,0.35)]">
      <div className="relative aspect-video w-full">
        <Image
          src="/branding/HeroBild.png"
          alt="ReceptaAI Dashboard & AI Call"
          fill
          className="object-cover"
          priority
        />

        {/* rechte Blur-Edge (subtil) */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-white/70 to-transparent blur-[2px]" />

        {/* optional: very subtle top highlight */}
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
                In 3 Schritten zur automatisierten Kundenbetreuung
              </p>
              <p className="mt-2 text-sm text-slate-600">
                ReceptaAI übernimmt den gesamten Telefonfluss – von der
                Begrüßung bis zur Terminbuchung.
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
                  Kunde ruft an, ReceptaAI geht sofort ran – kein Besetztzeichen
                  mehr, keine verpassten Anrufe.
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
                  Intelligente Spracherkennung analysiert das Anliegen und
                  entscheidet, ob gebucht, beantwortet oder weitergeleitet wird.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-xl">
                  📅
                </div>
                <h3 className="text-base font-semibold text-slate-900">
                  Termin im Kalender
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Bestätigte Termine werden direkt in deinen Kalender
                  eingetragen – inklusive aller wichtigen Infos.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* VALUE / PAINPOINTS */}
        <section className="bg-slate-50">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 ">
            <div className="text-center">
              <p className="text-sm font-semibold text-blue-600">
                Mehr Zeit, mehr Umsatz
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                Dein Gewinn durch intelligente Automatisierung
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
                  Mehr Umsatz durch bessere Erreichbarkeit – ReceptaAI ist
                  durchgehend verfügbar, auch wenn dein Team ausgelastet ist.
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-lg">
                  💶
                </div>
                <h3 className="text-base font-semibold text-slate-900">
                  Spart Personalkosten
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Reduziere den Bedarf an zusätzlichem Empfangspersonal und
                  entlaste dein bestehendes Team.
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-lg">
                  🧑‍⚕️
                </div>
                <h3 className="text-base font-semibold text-slate-900">
                  Entlastet das Team
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Dein Team kann sich auf die wichtigen Aufgaben fokussieren,
                  während ReceptaAI Routineanfragen übernimmt.
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-lg">
                  📈
                </div>
                <h3 className="text-base font-semibold text-slate-900">
                  Professionelles Kundenerlebnis
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Einheitliche Begrüßung, klare Abläufe und strukturierte
                  Informationen – bei jedem Anruf.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 ">
            <div className="text-center">
              <p className="text-sm font-semibold text-blue-600">
                Leistungsstarke Features
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                Alles, was du brauchst, um deine Kundenbetreuung zu
                automatisieren
              </h2>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-lg">
                  🎙️
                </div>
                <h3 className="text-base font-semibold text-slate-900">
                  Echtzeit-Spracherkennung
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Mehrsprachige KI versteht deine Kunden und erkennt
                  Rückfragen, Termine und wichtige Infos zuverlässig.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-lg">
                  📅
                </div>
                <h3 className="text-base font-semibold text-slate-900">
                  Google-Kalender-Sync
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Automatische Synchronisation mit deinem Kalender – freie
                  Slots werden erkannt und direkt gebucht.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-lg">
                  💬
                </div>
                <h3 className="text-base font-semibold text-slate-900">
                  Smart FAQ & Weiterleitung
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Beantwortet häufige Fragen automatisch und verbindet nur bei
                  Bedarf mit deinem Team.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-lg">
                  📊
                </div>
                <h3 className="text-base font-semibold text-slate-900">
                  Anruf-Statistiken & Voicelogs
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Volle Transparenz über alle Gespräche – inkl. Klassifizierung
                  und Status der Anrufe.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* TRUST BADGES */}
        <section className="bg-sky-50">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 ">
            <div className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
              <div className="grid gap-6 text-sm text-slate-700 md:grid-cols-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-2xl bg-blue-100">
                    🔒
                  </div>
                  <div>
                    <p className="font-semibold">DSGVO-konform entwickelt</p>
                    <p className="text-xs text-slate-500">
                      Deine Kundendaten werden nach strengen
                      Datenschutzrichtlinien verarbeitet.
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
                      Infrastruktur in Europa – keine Datenübertragung in
                      Drittländer.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-2xl bg-blue-100">
                    ⚖️
                  </div>
                  <div>
                    <p className="font-semibold">Datenminimierung</p>
                    <p className="text-xs text-slate-500">
                      Es werden nur die Informationen gespeichert, die wirklich
                      nötig sind.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-2xl bg-blue-100">
                    🗑️
                  </div>
                  <div>
                    <p className="font-semibold">Audio-Löschung</p>
                    <p className="text-xs text-slate-500">
                      Audiodaten können nach der Verarbeitung automatisiert
                      gelöscht werden.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section
          id="pricing"
          className="border-t border-slate-200 bg-white"
        >
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 ">
            <div className="text-center">
              <p className="text-sm font-semibold text-blue-600">
                Transparente Preise
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                Ein Paket, alles drin – perfekt für KMU
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Monatlich kündbar, volle Kontrolle über dein Telefon.
              </p>
            </div>

            <div className="mt-10 flex justify-center">
              <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-md md:p-10">
                <p className="text-sm font-semibold text-blue-600">
                  Starter
                </p>
                <div className="mt-4 flex items-baseline gap-2">
                  <p className="text-4xl font-semibold tracking-tight text-slate-900">
                    99&nbsp;€
                  </p>
                  <span className="text-sm text-slate-500">/ Monat</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Ideal für eine Leitung, einen Kalender und ein zentrales
                  Team.
                </p>

                <ul className="mt-6 space-y-2 text-sm text-slate-700">
                  <li>• 1 Telefonleitung</li>
                  <li>• 1 Google-Kalender-Integration</li>
                  <li>• Smart FAQ & Weiterleitung</li>
                  <li>• Anruf-Reports & Statistiken</li>
                  <li>• Mehrsprachige Spracherkennung</li>
                  <li>• DSGVO-konformes EU-Hosting</li>
                </ul>

                <button
                  type="button"
                  onClick={startCheckout}
                  disabled={loading}
                  className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-blue-700 disabled:opacity-70"
                >
                  {loading ? "Weiterleitung zu Stripe..." : "Jetzt Starter-Abo buchen"}
                </button>

                <p className="mt-3 text-center text-xs text-slate-500">
                  Du wirst zu Stripe weitergeleitet, um dein ReceptaAI-Abo
                  sicher zu bezahlen.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="bg-slate-50">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 ">
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
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6  text-center">
            <p className="text-sm font-semibold uppercase tracking-wide">
              Bereit für 24/7 Kundenbetreuung?
            </p>
            <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">
              Starte mit ReceptaAI und verpasse keinen wichtigen Anruf mehr.
            </h2>
            <p className="mt-3 text-sm text-sky-100">
              Monatlich kündbar, ohne lange Vertragsbindung.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <button
                type="button"
                onClick={startCheckout}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-blue-700 shadow-md hover:bg-slate-100 disabled:opacity-70"
              >
                {loading ? "Weiterleitung zu Stripe..." : "Jetzt starten"}
              </button>
              <a
                href="#features"
                className="text-sm font-medium text-sky-100 underline-offset-4 hover:underline"
              >
                Erst mehr über die Features lesen
              </a>
            </div>
          </div>
        </section>

{/* FOOTER */}
<footer className="border-t border-slate-200 bg-white">
  <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 ">
    <div className="grid gap-8 md:grid-cols-4">
      <div className="space-y-3">
       <Brand href="/" variant="horizontal" size="md" />
        <p className="text-sm text-slate-600">
          Dein KI-Telefonassistent für 24/7 Kundenbetreuung – DSGVO-konform und mehrsprachig.
        </p>
      </div>

      <div className="space-y-2 text-sm">
        <p className="font-semibold text-slate-900">Produkt</p>
        <a href="#features" className="block text-slate-600 hover:text-slate-900">
          Features
        </a>
        <a href="#pricing" className="block text-slate-600 hover:text-slate-900">
          Preise
        </a>
        <a href="#faq" className="block text-slate-600 hover:text-slate-900">
          FAQ
        </a>
        <Link href="/login" className="block text-slate-600 hover:text-slate-900">
          Login
        </Link>
      </div>

      <div className="space-y-2 text-sm">
        <p className="font-semibold text-slate-900">Rechtliches</p>
        <Link href="/impressum" className="block text-slate-600 hover:text-slate-900">
          Impressum
        </Link>
        <Link href="/datenschutz" className="block text-slate-600 hover:text-slate-900">
          Datenschutz
        </Link>
        <Link href="/agb" className="block text-slate-600 hover:text-slate-900">
          AGB (B2B)
        </Link>
        <Link href="/kontakt" className="block text-slate-600 hover:text-slate-900">
          Kontakt
        </Link>
      </div>

      <div className="space-y-2 text-sm">
        <p className="font-semibold text-slate-900">Kontakt</p>
        <p className="text-slate-600">Michael F. E. Eraso Horn</p>
        <a className="block text-slate-600 hover:text-slate-900" href="mailto:info@receptaai.de">
          info@receptaai.de
        </a>
        <a className="block text-slate-600 hover:text-slate-900" href="tel:+491771572418">
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
