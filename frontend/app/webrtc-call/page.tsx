"use client";
import * as React from "react";
import { Device } from "@twilio/voice-sdk";

export default function WebRTCCallPage() {
  const [device, setDevice] = React.useState<Device | null>(null);
  const [status, setStatus] = React.useState("idle");
  const [conn, setConn] = React.useState<any>(null);
  const [logs, setLogs] = React.useState<string[]>([]);
  const [inputs, setInputs] = React.useState<MediaDeviceInfo[]>([]);
  const [outputs, setOutputs] = React.useState<MediaDeviceInfo[]>([]);
  const [inId, setInId] = React.useState<string>("");
  const [outId, setOutId] = React.useState<string>("");

  function log(s: string) { setLogs((L) => [s, ...L].slice(0, 80)); }

  async function enumerate() {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true }); // Prompt erzwingen
      const devs = await navigator.mediaDevices.enumerateDevices();
      setInputs(devs.filter((d) => d.kind === "audioinput"));
      setOutputs(devs.filter((d) => d.kind === "audiooutput"));
    } catch (e: any) {
      log("getUserMedia error: " + (e.message || e));
    }
  }

  async function init() {
    setStatus("requesting-token");
    const r = await fetch("/api/twilio-token");
    const { token, error } = await r.json();
    if (error) { log("Token error: " + error); setStatus("idle"); return; }

    const dev = new Device(token, { logLevel: 1 });
    dev.on("registered", () => log("Device registered"));
    dev.on("error", (e) => log("Device error: " + e.message));
    dev.on("incoming", (c) => { log("incoming call"); c.reject(); });

    // Lautsprecher/Ringer auf 'default' setzen
    try {
      (Device as any).audio?.speakerDevices?.set("default");
     (Device as any).audio?.ringerDevices?.set("default");
      log("speaker/ringer set to default");
    } catch (e: any) {
      log("audio set default error: " + (e.message || e));
    }

    await dev.register();
    setDevice(dev);
    setStatus("ready");

    // Geräte auflisten
    await enumerate();
  }

  async function applyDevices() {
    try {
      if (inId) {
        await (Device as any).audio?.setInputDevice(inId);
        log("input set: " + inId);
      }
      if (outId) {
        await (Device as any).audio?.speakerDevices?.set(outId);
        await (Device as any).audio?.ringerDevices?.set(outId);
        log("output set: " + outId);
      }
    } catch (e: any) {
      log("applyDevices error: " + (e.message || e));
    }
  }

  async function startCall() {
    if (!device) return;
    await applyDevices(); // sicherstellen, dass Auswahl aktiv ist
    setStatus("connecting");
    const c = await device.connect(); // nutzt deine TwiML App → /api/call
    setConn(c);
    log("connecting...");

    // Lautstärke-Events: zeigt ob Audio fließt
    c.on("volume", (inVol: number, outVol: number) => {
      log(`volume in:${inVol.toFixed(2)} out:${outVol.toFixed(2)}`);
    });

    c.on("accept", () => { setStatus("in-call"); log("call accepted"); });
    c.on("disconnect", () => { setStatus("ready"); setConn(null); log("call ended"); });
    c.on("error", (e: any) => { log("call error: " + e.message); });
  }

  function hangup() { conn?.disconnect(); }

  React.useEffect(() => () => { device?.destroy(); }, [device]);

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Twilio WebRTC – Test</h1>
      <p>Status: <b>{status}</b></p>

      <div className="flex gap-3 flex-wrap">
        <button onClick={init} className="px-4 py-2 rounded-2xl bg-black text-white">
          1) Device registrieren
        </button>
        <button onClick={startCall} disabled={!device} className="px-4 py-2 rounded-2xl bg-green-600 text-white">
          2) Call starten
        </button>
        <button onClick={hangup} disabled={!conn} className="px-4 py-2 rounded-2xl bg-red-600 text-white">
          Auflegen
        </button>
        <button onClick={enumerate} className="px-4 py-2 rounded-2xl bg-zinc-700 text-white">
          Geräte neu laden
        </button>
      </div>

      {/* Geräteauswahl */}
      <div className="flex gap-3">
        <div>
          <label className="block text-sm">Mikro</label>
          <select className="border rounded p-1" value={inId} onChange={(e) => setInId(e.target.value)}>
            <option value="">(Browser-Standard)</option>
            {inputs.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm">Lautsprecher</label>
          <select className="border rounded p-1" value={outId} onChange={(e) => setOutId(e.target.value)}>
            <option value="">(Browser-Standard)</option>
            {outputs.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId}</option>)}
          </select>
        </div>
      </div>

      <p className="text-sm text-zinc-500">
        Tipp: In Chrome Mikrofon-/Lautsprecherrechte erlauben. Wenn du nichts hörst, ein anderes Ausgabegerät wählen.
        „volume in/out“ Einträge zeigen, ob Audio ankommt/rausgeht.
      </p>

      <pre className="bg-gray-100 p-3 rounded text-xs h-48 overflow-auto">
{logs.join("\n")}
      </pre>
    </div>
  );
}
