import type { SupabaseClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
import {
  getBusinessHoursForDay,
  toZoned,
  isWithinBusinessHours,
} from "@/lib/callflow/domain/appointments/business-hours";
import {
  prefetchOverlaps,
  makeOverlapKey,
  countOverlapsInIntervals,
  hasCapacity,
  type ApptInterval,
} from "@/lib/callflow/domain/appointments/overlap";

export async function getParallelCapacity(
  supabase: SupabaseClient,
  clientId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("clients")
    .select("parallel_capacity")
    .eq("id", clientId)
    .maybeSingle();

  if (error) {
    console.error("[AVAILABILITY] getParallelCapacity error", error);
    return 1;
  }

  const raw = Number((data as any)?.parallel_capacity ?? 1);
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

export async function findNextFreeSlots(args: {
  supabase: SupabaseClient;
  overlapCache: Map<string, ApptInterval[]>;
  clientId: string;
  staffId: string | null;
  day: Date;
  durationMin: number;
  tz: string;
  maxSuggestions?: number;
  windowStartMin?: number;
  windowEndMin?: number;
  capacity?: number;
}) {
  const {
    supabase,
    overlapCache,
    clientId,
    staffId,
    day,
    durationMin,
    tz,
    maxSuggestions = 3,
    windowStartMin,
    windowEndMin,
    capacity = 1,
  } = args;

  const suggestions: string[] = [];
  const dayStartTZ = toZoned(day, tz).startOf("day");

  const hours = await getBusinessHoursForDay(
    supabase,
    clientId,
    dayStartTZ.toJSDate(),
    tz
  );

  if (!hours || hours.is_closed) return suggestions;

  let startMinute = hours.open_min;
  let endMinute = hours.close_min;

  if (typeof windowStartMin === "number" && windowStartMin > startMinute) {
    startMinute = windowStartMin;
  }

  if (typeof windowEndMin === "number" && windowEndMin < endMinute) {
    endMinute = windowEndMin;
  }

  const windowStartISO = dayStartTZ
    .plus({ minutes: startMinute })
    .toUTC()
    .toISO({ suppressMilliseconds: true })!;

  const windowEndISO = dayStartTZ
    .plus({ minutes: endMinute })
    .toUTC()
    .toISO({ suppressMilliseconds: true })!;

  await prefetchOverlaps(
    supabase,
    overlapCache,
    clientId,
    staffId,
    windowStartISO,
    windowEndISO
  );

  const cacheKey = makeOverlapKey(
    clientId,
    staffId,
    windowStartISO,
    windowEndISO
  );

  const existing = overlapCache.get(cacheKey) ?? [];

  for (
    let m = startMinute;
    m + durationMin <= endMinute && suggestions.length < maxSuggestions;
    m += 15
  ) {
    const cStartISO = dayStartTZ
      .plus({ minutes: m })
      .toUTC()
      .toISO({ suppressMilliseconds: true })!;

    const cEndISO = DateTime.fromISO(cStartISO)
      .plus({ minutes: durationMin })
      .toUTC()
      .toISO({ suppressMilliseconds: true })!;

    const overlapCount = countOverlapsInIntervals(existing, cStartISO, cEndISO);

    if (overlapCount < capacity) {
      const localLabel = DateTime.fromISO(cStartISO, { zone: "utc" })
        .setZone(tz)
        .toFormat("HH:mm");

      suggestions.push(localLabel);
    }
  }

  return suggestions;
}

export async function checkSlotAvailability(args: {
  supabase: SupabaseClient;
  overlapCache: Map<string, ApptInterval[]>;
  clientId: string;
  startISO: string;
  endISO: string;
  tz: string;
  staffId?: string | null;
  capacity: number;
}) {
  const {
    supabase,
    overlapCache,
    clientId,
    startISO,
    endISO,
    tz,
    staffId,
    capacity,
  } = args;

  const start = new Date(startISO);
  const end = new Date(endISO);

  const hoursCheck = await isWithinBusinessHours({
    supabase,
    clientId,
    start,
    end,
    tz,
  });

  if (!hoursCheck.ok) {
    return {
      ok: false as const,
      reason: hoursCheck.reason,
    };
  }

  const free = await hasCapacity({
    supabase,
    overlapCache,
    clientId,
    startISO,
    endISO,
    capacity,
    staffId: staffId ?? null,
  });

  if (!free) {
    return {
      ok: false as const,
      reason: "slot_taken" as const,
    };
  }

  return {
    ok: true as const,
  };
}