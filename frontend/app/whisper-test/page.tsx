"use client";
import { useState } from "react";

export default function WhisperTestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/whisper", {
        method: "POST",
        body: fd,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Upload failed");
      setResult(json);
    } catch (err: any) {
      setError(err.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Whisper Test</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full"
        />
        <button
          className="px-4 py-2 rounded-2xl shadow bg-black text-white disabled:opacity-50"
          disabled={!file || loading}
        >
          {loading ? "Transkribiere..." : "Upload & Transkribieren"}
        </button>
      </form>

      {error && <p className="text-red-600">Fehler: {error}</p>}
      {result && (
        <div className="p-4 rounded-2xl bg-gray-100">
          <p className="font-semibold mb-1">Text:</p>
          <p className="whitespace-pre-wrap">{result.text}</p>
          <pre className="mt-3 text-xs bg-white p-2 rounded">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}

      <p className="text-sm text-gray-500">
        Hinweis: Der Endpoint akzeptiert nur <code>POST multipart/form-data</code>. Ein direkter Aufruf im
        Browser (<code>GET</code>) zeigt jetzt einen Healthcheck statt 405.
      </p>
    </div>
  );
}
