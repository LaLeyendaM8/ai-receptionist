"use client";
import * as React from "react";

export default function GptTestPage() {
  const [text, setText] = React.useState(
    "Hallo, ich möchte morgen einen Friseurtermin um 10 Uhr ausmachen."
  );
  const [res, setRes] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function run() {
    setLoading(true);
    setErr(null);
    setRes(null);
    try {
      const r = await fetch("/api/gpt-receptionist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Request failed");
      setRes(j);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">GPT Receptionist Test</h1>
      <textarea
        className="w-full border rounded p-2"
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        onClick={run}
        disabled={loading}
        className="px-4 py-2 rounded-2xl bg-black text-white disabled:opacity-50"
      >
        {loading ? "Fragt GPT..." : "Senden"}
      </button>

      {err && <p className="text-red-600">Fehler: {err}</p>}
      {res && (
        <pre className="bg-gray-100 p-3 rounded text-sm">
          {JSON.stringify(res, null, 2)}
        </pre>
      )}
    </div>
  );
}
