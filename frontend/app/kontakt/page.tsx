import { revalidatePath } from "next/cache";
import { Mail, MessageSquare, User } from "lucide-react";

// Wenn ihr Resend schon im Projekt habt, kannst du hier importieren.
// Falls nicht, sag Bescheid – dann switchen wir auf Supabase-Table.
import { Resend } from "resend";

export const dynamic = "force-dynamic";

async function sendContactAction(formData: FormData): Promise<void> {
  "use server";

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!name || !email || !message) {
    // optional: einfach abbrechen
    return;
  }

  // TODO: später Resend oder Supabase insert
  console.log("[CONTACT]", { name, email, message });
}


export default async function KontaktPage() {
  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-10">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Support
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Kontakt
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Schreib uns eine Nachricht – wir antworten so schnell wie möglich.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Info */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#3B82F6]">
                  <Mail className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    E-Mail
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Für Fragen zu Onboarding, Billing oder Support.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-2 text-sm">
                <p className="text-slate-600">
                  <span className="font-medium text-slate-900">Support:</span>{" "}
                  <a
                    href="mailto:info@receptaai.de"
                    className="text-[#3B82F6] hover:underline"
                  >
                    info@receptaai.de
                  </a>
                </p>
                <p className="text-xs text-slate-400">
                  (B2B) Bitte möglichst Firmenname + kurze Beschreibung mitschicken.
                </p>
              </div>
            </div>

            {/* Form */}
            <div>
              <form action={sendContactAction} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Name
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      name="name"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-10 py-2 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[#3B82F6]/20"
                      placeholder="Dein Name"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    E-Mail
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      name="email"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-10 py-2 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[#3B82F6]/20"
                      placeholder="name@firma.de"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Nachricht
                  </label>
                  <div className="relative">
                    <MessageSquare className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <textarea
                      name="message"
                      rows={5}
                      className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-10 py-2 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[#3B82F6]/20"
                      placeholder="Worum geht’s?"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-[#3B82F6] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#2563EB]"
                >
                  Nachricht senden
                </button>

                <p className="text-xs text-slate-400">
                  Hinweis: Mit dem Absenden verarbeitest du deine Angaben zur
                  Bearbeitung deiner Anfrage (B2B).
                </p>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
