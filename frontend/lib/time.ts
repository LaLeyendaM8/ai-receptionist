// lib/time.ts
import { DateTime } from "luxon";

/**
 * Baut aus "YYYY-MM-DD" + "HH:mm" eine UTC-ISO Zeit,
 * interpretiert in einer IANA Timezone (z.B. Europe/Berlin).
 */
export function localDateTimeToUtcIso(
  date: string,
  time: string,
  tz: string
) {
  const dt = DateTime.fromFormat(`${date} ${time}`, "yyyy-MM-dd HH:mm", {
    zone: tz,
  });

  if (!dt.isValid) {
    throw new Error(`Invalid date/time: ${date} ${time} (${tz})`);
  }

  return dt.toUTC().toISO(); // ISO in UTC (Z)
}

/**
 * Wandelt eine UTC ISO Zeit in "HH:mm" in der gewünschten Timezone.
 */
export function utcIsoToLocalHm(utcIso: string, tz: string) {
  const dt = DateTime.fromISO(utcIso, { zone: "utc" }).setZone(tz);
  if (!dt.isValid) throw new Error(`Invalid ISO: ${utcIso}`);
  return dt.toFormat("HH:mm");
}
