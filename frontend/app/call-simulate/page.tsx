"use client";
import * as React from "react";

function extractPlayUrl(twiml: string) {
  const m = twiml.match(/<Play>([^<]+)<\/Play>/i);
  return m?.[1] || null;
}

export default function CallSimulatePage() {
  const [initXml, setInitXml] = React.useState<string>("");
  const [userText, setUserText] = React.useState(
    "Hallo, ich möchte morgen um 10:30 Uhr einen Termin."
  );
  const [handleXml, setHandleXml] = React.useState<string>("");
  const [playUrl, setPlayUrl] = React.useState<string | null>(null);
  const [replyText, setReplyText] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function callInit() {
    setErr(null);
    setInitXml("");
    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "CallSid=CA_test&From=%2B491701234567&To=%2B15551234567",
      });
      const xml = await res.text();
      setInitXml(xml);
    } catch (e: any) {
      setErr(e.message || String(e));
    }
  }

  async function sendUtterance() {
    setErr(null);
    setLoading(true);
    setHandleXml("");
    setPlayUrl(null);
    setReplyText(null);
    try {
      const res = await fetch("/api/call/handle", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `SpeechResult=${encodeURIComponent(userText)}`,
      });
      const xml = await res.text();
      setHandleXml(xml);

      const url = extractPlayUrl(xml);
      setPlayUrl(url || null);

      // Falls unsere /api/speak?text=... genutzt wird, Text aus Query holen
      if (url) {
        try {
          const u = new URL(url);
          const t = u.searchParams.get("text");
          if (t) setReplyText(decodeURIComponent(t));
        } catch { /* ignore */ }
      }
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function playAudio() {
    if (!playUrl) return;
    try {
      const audio = new Audio(playUrl);
      await audio.play();
    } catch (e: any) {
      setErr(`Audio-Fehler: ${e.message || e}`);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-3xl font-bold">Twilio Call – Lokale Simulation</h1>

      <div className="space-y-3">
        <button
          onClick={callInit}
          className="px-4 py-2 rounded-2xl bg-zinc-900 text-white"
        >
          1) Einstieg: /api/call (TwiML anzeigen)
        </button>
        {initXml && (
          <pre className="bg-zinc-100 p-3 rounded text-sm overflow-auto">
{initXml}
          </pre>
        )}
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-medium">Gesprochener Text (simuliert)</label>
        <textarea
          className="w-full border rounded p-2"
          rows={3}
          value={userText}
          onChange={(e) => setUserText(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <button
            onClick={sendUtterance}
            disabled={loading}
            className="px-4 py-2 rounded-2xl bg-black text-white disabled:opacity-50"
          >
            2) /api/call/handle (Antwort generieren)
          </button>
          {playUrl && (
            <button
              onClick={playAudio}
              className="px-4 py-2 rounded-2xl bg-blue-600 text-white"
            >
              🔊 Antwort abspielen
            </button>
          )}
        </div>

        {replyText && (
          <p className="text-sm text-zinc-600">
            <span className="font-semibold">Reply-Text:</span> {replyText}
          </p>
        )}

        {handleXml && (
          <pre className="bg-zinc-100 p-3 rounded text-sm overflow-auto">
{handleXml}
          </pre>
        )}
      </div>

      {playUrl && (
        <p className="text-xs text-zinc-500">
          Audio-URL aus TwiML: <code>{playUrl}</code>
        </p>
      )}

      {err && <p className="text-red-600">Fehler: {err}</p>}

      <p className="text-xs text-zinc-500">
        Hinweis: Diese Seite simuliert den Twilio-Flow ohne echten Anruf. Sie postet
        form-urlencoded an <code>/api/call</code> und <code>/api/call/handle</code> und
        extrahiert die <code>&lt;Play&gt;</code>-URL zum Abspielen.
      </p>
    </div>
  );
}
