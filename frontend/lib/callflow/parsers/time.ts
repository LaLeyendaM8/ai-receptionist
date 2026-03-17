export type TimeParseResult = {
  value: string | null; // HH:mm
  confidence: number;
  raw: string;
};

function normalize(text: string) {
  return (text || "")
    .trim()
    .toLowerCase()
    .replace(/[.,!?]/g, " ")
    .replace(/\s+/g, " ");
}

const GERMAN_HOUR_WORDS: Record<string, number> = {
  eins: 1,
  ein: 1,
  eine: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  fünf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
  elf: 11,
  zwölf: 12,
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatTime(hour: number, minute: number) {
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${pad(hour)}:${pad(minute)}`;
}

function applyDayPeriod(hour: number, text: string) {
  const t = normalize(text);

  if (t.includes("nachmittags") || t.includes("abends")) {
    if (hour >= 1 && hour <= 11) return hour + 12;
  }

  if (t.includes("morgens") || t.includes("vormittags")) {
    if (hour === 12) return 0;
    return hour;
  }

  if (t.includes("mittags")) {
    if (hour >= 1 && hour <= 11) return hour + 12;
  }

  return hour;
}

export function parseTime(text: string): TimeParseResult {
  const raw = text || "";
  const normalized = normalize(raw);

  if (!normalized) {
    return { value: null, confidence: 0, raw };
  }

  // 16:30 / 9:15
  const colonMatch = normalized.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (colonMatch) {
    const hour = Number(colonMatch[1]);
    const minute = Number(colonMatch[2]);
    return {
      value: formatTime(hour, minute),
      confidence: 0.99,
      raw,
    };
  }

  // 16 uhr / um 16 uhr / 16
  const hourMatch = normalized.match(/\b(?:um\s*)?([01]?\d|2[0-3])(?:\s*uhr)?\b/);
  if (hourMatch) {
    const rawHour = Number(hourMatch[1]);
    const adjusted = applyDayPeriod(rawHour, normalized);
    return {
      value: formatTime(adjusted, 0),
      confidence: normalized.includes("uhr") ? 0.97 : 0.75,
      raw,
    };
  }

  // halb fünf => 04:30
  const halbMatch = normalized.match(/\bhalb\s+(eins|ein|eine|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf)\b/);
  if (halbMatch) {
    const nextHour = GERMAN_HOUR_WORDS[halbMatch[1]];
    let hour = nextHour - 1;
    if (hour === 0) hour = 12;
    hour = applyDayPeriod(hour, normalized);
    return {
      value: formatTime(hour, 30),
      confidence: 0.93,
      raw,
    };
  }

  // viertel nach vier => 04:15
  const quarterAfter = normalized.match(
    /\bviertel nach\s+(eins|ein|eine|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf)\b/
  );
  if (quarterAfter) {
    let hour = GERMAN_HOUR_WORDS[quarterAfter[1]];
    hour = applyDayPeriod(hour, normalized);
    return {
      value: formatTime(hour, 15),
      confidence: 0.93,
      raw,
    };
  }

  // viertel vor fünf => 04:45
  const quarterBefore = normalized.match(
    /\bviertel vor\s+(eins|ein|eine|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf)\b/
  );
  if (quarterBefore) {
    let hour = GERMAN_HOUR_WORDS[quarterBefore[1]] - 1;
    if (hour === 0) hour = 12;
    hour = applyDayPeriod(hour, normalized);
    return {
      value: formatTime(hour, 45),
      confidence: 0.93,
      raw,
    };
  }

  return {
    value: null,
    confidence: 0,
    raw,
  };
}