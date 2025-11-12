// frontend/app/faq-test/page.tsx
"use client";
import { useState } from "react";

export default function FaqTest() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<any>(null);

  async function ask() {
    const r = await fetch("/api/ai/faq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: q }),
    });
    setRes(await r.json());
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">FAQ Test</h1>
      <input
        className="w-full border rounded px-3 py-2"
        placeholder="Ihre Frage…"
        value={q}
        onChange={e=>setQ(e.target.value)}
      />
      <button className="px-4 py-2 rounded bg-black text-white" onClick={ask}>Fragen</button>
      <pre className="text-sm bg-gray-100 p-3 rounded">{JSON.stringify(res, null, 2)}</pre>
    </div>
  );
}
