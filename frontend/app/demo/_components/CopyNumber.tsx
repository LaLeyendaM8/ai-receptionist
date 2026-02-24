"use client";

import { useState } from "react";

export default function CopyNumber({ number }: { number: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(number);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center justify-center rounded-xl border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-medium text-[#1E293B] shadow-sm transition hover:bg-[#F8FAFC]"
    >
      {copied ? "Nummer kopiert ✓" : "Nummer kopieren"}
    </button>
  );
}