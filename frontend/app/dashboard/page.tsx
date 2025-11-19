import { createClients } from "@/lib/supabaseClients";
import { getCurrentUserId } from "@/lib/authServer";
import {redirect} from "next/navigation"; 

export default async function DashboardPage() {
  const supabase = createClients();

  // 1) eingeloggten User holen
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/login"); // redirect ist `never`, TS weiß: ab hier immer userId
  }

  // 2) Client zu diesem User holen
  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("id, name")
    .eq("owner_user", userId)
    .maybeSingle();

  if (clientErr) {
    console.error("client_load_failed", clientErr);
    redirect("/onboarding");
  }

  if (!client) {
    // kein Client → zurück ins Onboarding
    redirect("/onboarding");
  }

  const clientId = client.id;

  // 3) Daten fürs Dashboard – alle gefiltert auf client_id
  const [{ data: calls }, { data: appointments }, { data: handoffs }] =
    await Promise.all([
      supabase
        .from("calls")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(10),

      supabase
        .from("appointments")
        .select("*")
        .eq("client_id", clientId)
        .order("start_time", { ascending: false })
        .limit(10),

      supabase
        .from("handoffs")
        .select("*")
        .eq("client_id", clientId)
        .eq("status", "open")
        .order("created_at", { ascending: false }),
    ]);

  return (
    <div className="p-6 space-y-12">
      <h1 className="text-2xl font-semibold">Admin Übersicht</h1>

      {/* ------------------ CALLS ------------------ */}
      <section>
        <h2 className="text-xl font-medium mb-2">Letzte Anrufe</h2>
        <table className="w-full border">
          <thead>
            <tr className="border-b bg-gray-100">
              <th className="p-2 text-left">ID</th>
              <th className="p-2 text-left">Von</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Datum</th>
            </tr>
          </thead>
          <tbody>
            {calls?.map((c) => (
              <tr key={c.id} className="border-b">
                <td className="p-2">{c.id}</td>
                <td className="p-2">{c.from_number}</td>
                <td className="p-2">{c.status}</td>
                <td className="p-2">{c.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ------------------ APPOINTMENTS ------------------ */}
      <section>
        <h2 className="text-xl font-medium mb-2">Gebuchte Termine</h2>
        <table className="w-full border">
          <thead>
            <tr className="border-b bg-gray-100">
              <th className="p-2 text-left">Titel</th>
              <th className="p-2 text-left">Start</th>
              <th className="p-2 text-left">Ende</th>
              <th className="p-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {appointments?.map((a) => (
              <tr key={a.id} className="border-b">
                <td className="p-2">{a.title}</td>
                <td className="p-2">{a.start_at}</td>
                <td className="p-2">{a.end_at}</td>
                <td className="p-2">{a.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ------------------ HANDOFFS / LOGS ------------------ */}
      <section>
        <h2 className="text-xl font-medium mb-2">Offene Weiterleitungen</h2>
        <table className="w-full border">
          <thead>
            <tr className="border-b bg-gray-100">
              <th className="p-2 text-left">Frage</th>
              <th className="p-2 text-left">Intent</th>
              <th className="p-2 text-left">Confidence</th>
              <th className="p-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {handoffs?.map((h) => (
              <tr key={h.id} className="border-b">
                <td className="p-2">{h.question}</td>
                <td className="p-2">{h.intent}</td>
                <td className="p-2">{h.confidence}</td>
                <td className="p-2">{h.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
