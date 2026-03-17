import type { SupabaseClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";

export type BusinessHoursRow = {
  weekday: number;
  open_min: number;
  close_min: number;
  is_closed: boolean;
};

export type HoursResult =
  | { ok: true }
  | { ok: false; reason: "no_hours" | "closed" | "outside" };

export function toZoned(date: Date, tz: string) {
  return DateTime.fromJSDate(date, { zone: tz });
}

export function weekdayInTZ(dateStr: string, tz: string) {
  const dt = DateTime.fromISO(dateStr, { zone: tz });
  return dt.weekday % 7;
}

export function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

export async function getBusinessHoursForDay(
  supabase: SupabaseClient,
  clientId: string,
  day: Date,
  tz: string
) {
  const weekday = toZoned(day, tz).weekday % 7;

  const { data, error } = await supabase
    .from("business_hours")
    .select("weekday, open_min, close_min, is_closed")
    .eq("client_id", clientId)
    .eq("weekday", weekday)
    .maybeSingle();

  if (error) {
    console.error("[BUSINESS_HOURS] getBusinessHoursForDay error", {
      clientId,
      weekday,
      error,
    });
    return null;
  }

  return (data ?? null) as BusinessHoursRow | null;
}

export async function isWithinBusinessHours(args: {
  supabase: SupabaseClient;
  clientId: string;
  start: Date;
  end: Date;
  tz: string;
}): Promise<HoursResult> {
  const { supabase, clientId, start, end, tz } = args;

  const s = toZoned(start, tz);
  const e = toZoned(end, tz);

  const weekday = s.weekday % 7;

  const { data: hours, error } = await supabase
    .from("business_hours")
    .select("weekday, open_min, close_min, is_closed")
    .eq("client_id", clientId)
    .eq("weekday", weekday)
    .maybeSingle();

  if (error) return { ok: false, reason: "no_hours" };
  if (!hours) return { ok: false, reason: "no_hours" };
  if (hours.is_closed) return { ok: false, reason: "closed" };

  const sMin = s.hour * 60 + s.minute;
  const eMin = e.hour * 60 + e.minute;

  if (sMin < hours.open_min || eMin > hours.close_min) {
    return { ok: false, reason: "outside" };
  }

  return { ok: true };
}