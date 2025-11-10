"use client";
import * as React from "react";

type VoiceResult = {
  success: boolean;
  transcript?: string;
  intent?: string;
  reply?: string;
  meta?: { language?: string; confidence?: number };
  error?: string;
};

export default function VoiceTestPage() {
  const [file, setFile] = React.useState<File | null>(null);
  const [res, setRes] = React.useState<VoiceResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  // Recorder
  const [recorder, setRecorder] = React.useState<MediaRecorder | null>(null);
  const chunksRef = React.useRef<BlobPart[]>([]);
  const [recording, setRecording] = React.useState(false);

  async function submit(f: File) {
    setLoading(true);
    setErr(null);
    setRes(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/voice-intent", { method: "POST", body: fd });
      const j = (await r.json()) as VoiceResult;
      if (!r.ok || !j.success) throw new Error(j.error || "Request failed");
      setRes(j);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  function onUploadSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (file) submit(file);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (ev) => ev.data && chunksRef.current.push(ev.data);
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        // Datei-Objekt bauen (für FormData)
        const f = new File([blob], `recording-${Date.now()}.webm`, { type: "audio/webm" });
        await submit(f);
        // Streams sauber beenden
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      setRecorder(mr);
      setRecording(true);
    } catch (e: any) {
      setErr(e.message ?? "Mikrofon-Zugriff fehlgeschlagen");
    }
  }

  function stopRecording() {
    recorder?.stop();
    setRecording(false);
    setRecorder(null);
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Voice → Intent Test</h1>

      {/* Upload */}
      <form onSubmit={onUploadSubmit} className="space-y-3">
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
          {loading ? "Wird transkribiert…" : "Upload & Analysieren"}
        </button>
      </form>

      {/* Recorder */}
      <div className="space-x-3">
        {!recording ? (
          <button
            onClick={startRecording}
            className="px-4 py-2 rounded-2xl shadow bg-green-600 text-white disabled:opacity-50"
            disabled={loading}
          >
            🎙️ Aufnahme starten
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="px-4 py-2 rounded-2xl shadow bg-red-600 text-white"
          >
            ⏹️ Aufnahme stoppen & senden
          </button>
        )}
      </div>

      {err && <p className="text-red-600">Fehler: {err}</p>}

      {res && (
  <div className="p-4 rounded-2xl bg-gray-100 space-y-2">
    {res.transcript && (
      <>
        <p className="font-semibold">Transkript:</p>
        <p className="whitespace-pre-wrap">{res.transcript}</p>
      </>
    )}
    <pre className="mt-3 text-sm bg-white p-3 rounded border">
      {JSON.stringify(res, null, 2)}
    </pre>

    {res?.reply && (
  <button
    onClick={async () => {
      try {
        const r = await fetch("/api/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: res.reply }),
        });

        const ct = r.headers.get("Content-Type") || "";
        if (!r.ok || !ct.startsWith("audio/")) {
          const msg = await r.text();
          throw new Error(msg || "TTS failed");
        }

        const blob = await r.blob();                 // sollte audio/mpeg sein
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        await audio.play();
      } catch (e: any) {
        alert(`TTS Fehler: ${e.message || e}`);
      }
    }}
    className="px-4 py-2 rounded-2xl bg-blue-600 text-white"
  >
    🔊 Antwort anhören
  </button>
)}
  </div>
)}

      <p className="text-xs text-gray-500">
        Tipp: Für klare Ergebnisse sprich nah ins Mikro, wenig Hall. WebM/Opus wird unterstützt.
      </p>
    </div>
  );
}
