export type ConfirmationParseResult = {
  value: boolean | null;
  confidence: number;
  normalized: string;
};

function normalize(text: string) {
  return (text || "")
    .trim()
    .toLowerCase()
    .replace(/[.,!?]/g, "")
    .replace(/\s+/g, " ");
}

const YES_PATTERNS = [
  "ja",
  "jap",
  "jawohl",
  "jo",
  "yes",
  "klar",
  "passt",
  "passt so",
  "genau",
  "stimmt",
  "richtig",
  "korrekt",
  "einverstanden",
  "gerne",
  "okay",
  "ok",
  "in ordnung",
  "perfekt",
  "mach das",
  "bitte",
];

const NO_PATTERNS = [
  "nein",
  "nee",
  "ne",
  "no",
  "nicht",
  "falsch",
  "stimmt nicht",
  "doch nicht",
  "auf keinen fall",
  "lieber nicht",
  "abbrechen",
  "stop",
];

export function parseConfirmation(text: string): ConfirmationParseResult {
  const normalized = normalize(text);

  if (!normalized) {
    return { value: null, confidence: 0, normalized };
  }

  if (YES_PATTERNS.includes(normalized)) {
    return { value: true, confidence: 0.98, normalized };
  }

  if (NO_PATTERNS.includes(normalized)) {
    return { value: false, confidence: 0.98, normalized };
  }

  if (YES_PATTERNS.some((p) => normalized.includes(p))) {
    return { value: true, confidence: 0.8, normalized };
  }

  if (NO_PATTERNS.some((p) => normalized.includes(p))) {
    return { value: false, confidence: 0.8, normalized };
  }

  return { value: null, confidence: 0, normalized };
}