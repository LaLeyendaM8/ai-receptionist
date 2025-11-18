import { createClients } from "@/lib/supabaseClients";

export default async function AdminDashboard() {
  const supabase = createClients();

  // 1) Letzte Anrufe holen
  const { data: calls } = await supabase
    .from("calls")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(10);

  // 2) Letzte Termine holen
  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, title, start_at, end_at, status, source")
    .order("start_at", { ascending: false })
    .limit(10);

  // 3) Logs holen (später evtl. handoffs / faq_logs)
  const { data: handoffs } = await supabase
    .from("handoffs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

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
