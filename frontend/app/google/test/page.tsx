"use client";
import { useState } from "react";

export default function GoogleTestPage() {
  const [msg, setMsg] = useState("");

  async function connectGoogle() {
    const res = await fetch("/api/google/oauth/start");
    const { url } = await res.json();
    window.location.href = url; // Weiterleitung zu Google Consent
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Google OAuth Test</h1>
      <button onClick={connectGoogle}>Google verbinden</button>
      <p>{msg}</p>
    </div>
  );
}
