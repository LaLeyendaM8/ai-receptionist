// kleine NLP-Helpers (de → ISO) – keep it local, no deps
export const SERVICE_MAP: Record<string, { title: string; durationMin: number }> = {
  "haarschnitt": { title: "Haarschnitt", durationMin: 30 },
  "schnitt":     { title: "Haarschnitt", durationMin: 30 },
  "color":       { title: "Farbe",       durationMin: 60 },
  "färben":      { title: "Farbe",       durationMin: 60 },
};

const WEEKDAYS = ["sonntag","montag","dienstag","mittwoch","donnerstag","freitag","samstag"];

export function normalizeDate(input: string, tz = "Europe/Berlin"): string | null {
  const now = new Date();
  const lower = input.toLowerCase();
  const addDays = (d:number) => { const x=new Date(now); x.setDate(x.getDate()+d); return x; };

  if (/\bmorgen\b/.test(lower))      return addDays(1).toISOString().slice(0,10);
  if (/\büBERmorgen\b|\bübergmorgen\b|\bübermorgen\b/.test(lower)) return addDays(2).toISOString().slice(0,10);

  // wochentag
  for (let i=0;i<7;i++){
    const d = addDays(i);
    if (WEEKDAYS[d.getDay()] && lower.includes(WEEKDAYS[d.getDay()])) {
      return d.toISOString().slice(0,10);
    }
  }

  // YYYY-MM-DD direkt
  const m = input.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return m[0];
  return null;
}

export function normalizeTime(input: string): string | null {
  const mm = input.match(/\b(\d{1,2})[:.](\d{2})\b/);
  if (!mm) return null;
  const h = String(Math.min(23, parseInt(mm[1],10))).padStart(2,"0");
  const m = String(Math.min(59, parseInt(mm[2],10))).padStart(2,"0");
  return `${h}:${m}`;
}

export function mapService(input: string): { title: string; durationMin: number } | null {
  const l = input.toLowerCase();
  for (const key of Object.keys(SERVICE_MAP)) {
    if (l.includes(key)) return SERVICE_MAP[key];
  }
  return null;
}
