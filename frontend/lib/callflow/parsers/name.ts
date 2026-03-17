export type NameParseResult = {
  value: string | null;
  confidence: number;
  raw: string;
};

function cleanup(text: string) {
  return (text || "")
    .trim()
    .replace(/[0-9]/g, "")
    .replace(/[.,!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function capitalizeWords(text: string) {
  return text
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

const INTRO_PATTERNS = [
  /^ich bin\s+/i,
  /^mein name ist\s+/i,
  /^das ist\s+/i,
  /^hier ist\s+/i,
  /^unter\s+/i,
  /^auf den namen\s+/i,
];

export function parseName(text: string): NameParseResult {
  const raw = text || "";
  let cleaned = cleanup(raw);

  if (!cleaned) {
    return { value: null, confidence: 0, raw };
  }

  for (const pattern of INTRO_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }

  cleaned = cleanup(cleaned);

  if (!cleaned) {
    return { value: null, confidence: 0, raw };
  }

  const parts = cleaned.split(" ").filter(Boolean);

  if (parts.length === 0 || parts.length > 4) {
    return { value: null, confidence: 0, raw };
  }

  const maybeName = capitalizeWords(parts.join(" "));

  // Zu viele typische Nicht-Namen ausschließen
  const lower = maybeName.toLowerCase();
  const blocked = [
    "morgen",
    "heute",
    "ja",
    "nein",
    "termin",
    "uhr",
    "haarschnitt",
    "balayage",
    "farbe",
  ];

  if (blocked.includes(lower)) {
    return { value: null, confidence: 0, raw };
  }

  return {
    value: maybeName,
    confidence: parts.length === 1 ? 0.8 : 0.92,
    raw,
  };
}