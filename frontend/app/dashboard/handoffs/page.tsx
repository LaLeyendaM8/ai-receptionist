// frontend/app/dashboard/handoffs/page.tsx

import { redirect } from "next/navigation";
import { createClients } from "@/lib/supabaseClients";
import { getCurrentUserId } from "@/lib/authServer";
import { ClipboardList, Check } from "lucide-react";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getStatusBadgeClasses(status: string | null | undefined) {
  const s = (status ?? "").toLowerCase();
  if (s === "open") return "bg-amber-50 text-amber-700";
  if (s === "closed") return "bg-emerald-50 text-emerald-700";
  return "bg-slate-100 text-slate-700";
}

export default async function HandoffsPage() {
  const supabase = await createClients();
  const userId = await getCurrentUserId(supabase);

  if (!userId) redirect("/login");

  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("id")
    .eq("owner_user", userId)
    .maybeSingle();

  if (clientErr || !client) {
    console.error("[HANDOFFS] client_load_failed", clientErr);
    redirect("/onboarding");
  }

  const clientId = client.id;

  // ✅ Server Action: Handoff abhaken
  async function closeHandoffAction(formData: FormData) {
    "use server";

    const id = String(formData.get("id") ?? "");
    if (!id) return;

    const supabase = await createClients();

    // Safety: nur innerhalb des Client-Kontexts updaten
    await supabase
      .from("handoffs")
      .update({ status: "closed" })
      .eq("id", id)
      .eq("client_id", clientId);

    revalidatePath("/dashboard/handoffs");
    revalidatePath("/dashboard");
  }

  const { data: handoffs } = await supabase
    .from("handoffs")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (handoffs ?? []).filter((h: any) => (h.status ?? "open") === "open");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-[#1E293B]">Handoffs</h1>
        <p className="mt-1 text-sm text-[#64748B]">
          Offene Fälle, die manuell übernommen werden sollen.
        </p>
      </div>
{/* Liste */}
<section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
  <div className="mb-4 flex items-center gap-2">
    <ClipboardList className="h-4 w-4 text-[#3B82F6]" />
    <h2 className="text-sm font-medium text-[#1E293B]">Offene Handoffs</h2>
  </div>

  {/* DESKTOP TABLE */}
  <div className="hidden md:block overflow-x-auto">
    <table className="min-w-full text-left text-sm text-[#1E293B]">
      <thead>
        <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#64748B]">
          <th className="px-4 py-3">Frage</th>
          <th className="px-4 py-3">Intent</th>
          <th className="px-4 py-3">Status</th>
          <th className="px-4 py-3">Zeit</th>
          <th className="px-4 py-3 text-right">Aktion</th>
        </tr>
      </thead>

      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={5} className="px-4 py-6 text-center text-sm text-[#94A3B8]">
              Keine offenen Handoffs 🎉
            </td>
          </tr>
        )}

        {rows.map((h: any) => (
          <tr
            key={h.id}
            className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]"
          >
            <td className="px-4 py-3 align-top">
              <div className="max-w-[520px] whitespace-pre-wrap text-sm text-[#1E293B]">
                {h.question}
              </div>
              {h.source && (
                <div className="mt-1 text-xs text-[#64748B]">Quelle: {h.source}</div>
              )}
            </td>

            <td className="px-4 py-3 align-top text-sm text-[#1E293B]">
              {h.intent ?? "unknown"}
            </td>

            <td className="px-4 py-3 align-top">
              <span
                className={
                  "inline-flex rounded-full px-3 py-1 text-xs font-medium " +
                  getStatusBadgeClasses(h.status)
                }
              >
                {h.status ?? "open"}
              </span>
            </td>

            <td className="px-4 py-3 align-top text-sm text-[#1E293B]">
              {formatDateTime(h.created_at)}
            </td>

            <td className="px-4 py-3 align-top text-right">
              <form action={closeHandoffAction}>
                <input type="hidden" name="id" value={h.id} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                  title="Abhaken"
                >
                  <Check className="h-3 w-3" />
                  Abhaken
                </button>
              </form>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>

  {/* MOBILE CARDS */}
  <div className="mt-3 space-y-3 md:hidden">
    {rows.length === 0 && (
      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-xs text-[#64748B]">
        Keine offenen Handoffs 🎉
      </div>
    )}

    {rows.map((h: any) => (
      <div key={h.id} className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-medium text-[#64748B]">
              {h.intent ?? "unknown"} • {formatDateTime(h.created_at)}
            </div>
            <div className="mt-2 whitespace-pre-wrap text-sm text-[#1E293B]">
              {h.question}
            </div>
            {h.source && (
              <div className="mt-2 text-xs text-[#64748B]">Quelle: {h.source}</div>
            )}
          </div>

          <span
            className={
              "inline-flex h-fit rounded-full px-3 py-1 text-xs font-medium " +
              getStatusBadgeClasses(h.status)
            }
          >
            {h.status ?? "open"}
          </span>
        </div>

        <div className="mt-3 flex justify-end">
          <form action={closeHandoffAction}>
            <input type="hidden" name="id" value={h.id} />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
              title="Abhaken"
            >
              <Check className="h-3 w-3" />
              Abhaken
            </button>
          </form>
        </div>
      </div>
    ))}
  </div>
</section>
    </div>
  );
}
