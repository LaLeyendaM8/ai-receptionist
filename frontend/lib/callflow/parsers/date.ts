import { DateTime } from "luxon";

export type DateParseResult = {
  value: string | null; // yyyy-MM-dd
  confidence: number;
  raw: string;
};

function normalize(text: string) {
  return (text || "")
    .trim()
    .toLowerCase()
    .replace(/[,!?]/g, " ")
    .replace(/\s+/g, " ");
}

const WEEKDAYS: Record<string, number> = {
  montag: 1,
  dienstag: 2,
  mittwoch: 3,
  donnerstag: 4,
  freitag: 5,
  samstag: 6,
  sonntag: 7,
};

function nextWeekday(base: DateTime, targetWeekday: number, forceNextWeek = false) {
  let diff = targetWeekday - base.weekday;
  if (diff <= 0) diff += 7;
  if (forceNextWeek) diff += 7;
  return base.plus({ days: diff });
}

export function parseDate(
  text: string,
  timezone = "Europe/Berlin",
  now?: DateTime
): DateParseResult {
  const raw = text || "";
  const normalized = normalize(raw);
  const base = (now ?? DateTime.now()).setZone(timezone);

  if (!normalized) {
    return { value: null, confidence: 0, raw };
  }

  if (normalized.includes("heute")) {
    return {
      value: base.toISODate(),
      confidence: 0.99,
      raw,
    };
  }

  if (normalized.includes("übermorgen")) {
    return {
      value: base.plus({ days: 2 }).toISODate(),
      confidence: 0.99,
      raw,
    };
  }

  if (normalized.includes("morgen")) {
    return {
      value: base.plus({ days: 1 }).toISODate(),
      confidence: 0.99,
      raw,
    };
  }

  for (const [label, weekday] of Object.entries(WEEKDAYS)) {
    if (normalized.includes(`nächsten ${label}`) || normalized.includes(`naechsten ${label}`)) {
      return {
        value: nextWeekday(base, weekday, true).toISODate(),
        confidence: 0.94,
        raw,
      };
    }

    if (normalized.includes(label)) {
      return {
        value: nextWeekday(base, weekday, false).toISODate(),
        confidence: 0.86,
        raw,
      };
    }
  }

  // 12.03.2026 / 12.03.26 / 12/03/2026
  const fullDateMatch = normalized.match(
    /\b(\d{1,2})[./](\d{1,2})[./](\d{2,4})\b/
  );
  if (fullDateMatch) {
    const day = Number(fullDateMatch[1]);
    const month = Number(fullDateMatch[2]);
    let year = Number(fullDateMatch[3]);

    if (year < 100) {
      year += 2000;
    }

    const dt = DateTime.fromObject(
      { year, month, day },
      { zone: timezone }
    );

    if (dt.isValid) {
      return {
        value: dt.toISODate(),
        confidence: 0.98,
        raw,
      };
    }
  }

  // 12.03. / 12/03
  const shortDateMatch = normalized.match(/\b(\d{1,2})[./](\d{1,2})(?:[./])?\b/);
  if (shortDateMatch) {
    const day = Number(shortDateMatch[1]);
    const month = Number(shortDateMatch[2]);

    let year = base.year;
    let dt = DateTime.fromObject({ year, month, day }, { zone: timezone });

    if (dt.isValid && dt < base.startOf("day")) {
      dt = dt.plus({ years: 1 });
    }

    if (dt.isValid) {
      return {
        value: dt.toISODate(),
        confidence: 0.9,
        raw,
      };
    }
  }

  return {
    value: null,
    confidence: 0,
    raw,
  };
}