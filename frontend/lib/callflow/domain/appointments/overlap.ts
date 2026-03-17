import type { SupabaseClient } from "@supabase/supabase-js";

export type ApptInterval = {
  start_at: string;
  end_at: string;
};

export function intervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
) {
  return aStart < bEnd && aEnd > bStart;
}

export function makeOverlapKey(
  clientId: string,
  staffId: string | null,
  windowStartISO: string,
  windowEndISO: string
) {
  return `${clientId}|${staffId ?? "none"}|${windowStartISO}|${windowEndISO}`;
}

export async function prefetchOverlaps(
  supabase: SupabaseClient,
  overlapCache: Map<string, ApptInterval[]>,
  clientId: string,
  staffId: string | null,
  windowStartISO: string,
  windowEndISO: string
) {
  const key = makeOverlapKey(clientId, staffId, windowStartISO, windowEndISO);
  if (overlapCache.has(key)) return key;

  let q = supabase
    .from("appointments")
    .select("start_at,end_at")
    .eq("client_id", clientId)
    .neq("status", "cancelled")
    .lt("start_at", windowEndISO)
    .gt("end_at", windowStartISO);

  if (staffId) q = q.eq("staff_id", staffId);

  const { data, error } = await q;

  if (error) {
    console.error("[OVERLAP] prefetchOverlaps error", error);
    overlapCache.set(key, []);
    return key;
  }

  overlapCache.set(key, (data ?? []) as ApptInterval[]);
  return key;
}

export function countOverlapsInIntervals(
  existing: ApptInterval[],
  startISO: string,
  endISO: string
) {
  const cStart = new Date(startISO);
  const cEnd = new Date(endISO);

  return existing.reduce((count, a) => {
    const overlaps = intervalsOverlap(
      cStart,
      cEnd,
      new Date(a.start_at),
      new Date(a.end_at)
    );
    return overlaps ? count + 1 : count;
  }, 0);
}

export async function hasOverlap(args: {
  supabase: SupabaseClient;
  overlapCache: Map<string, ApptInterval[]>;
  clientId: string;
  startISO: string;
  endISO: string;
  staffId?: string | null;
}): Promise<boolean> {
  const { supabase, overlapCache, clientId, startISO, endISO, staffId } = args;

  const day = new Date(startISO);
  day.setUTCHours(0, 0, 0, 0);

  const windowStart = new Date(day);
  const windowEnd = new Date(day);
  windowEnd.setUTCHours(23, 59, 59, 999);

  const windowStartISO = windowStart.toISOString();
  const windowEndISO = windowEnd.toISOString();

  await prefetchOverlaps(
    supabase,
    overlapCache,
    clientId,
    staffId ?? null,
    windowStartISO,
    windowEndISO
  );

  const key = makeOverlapKey(
    clientId,
    staffId ?? null,
    windowStartISO,
    windowEndISO
  );

  const existing = overlapCache.get(key) ?? [];
  const cStart = new Date(startISO);
  const cEnd = new Date(endISO);

  return existing.some((a) =>
    intervalsOverlap(cStart, cEnd, new Date(a.start_at), new Date(a.end_at))
  );
}

export async function hasCapacity(args: {
  supabase: SupabaseClient;
  overlapCache: Map<string, ApptInterval[]>;
  clientId: string;
  startISO: string;
  endISO: string;
  capacity: number;
  staffId?: string | null;
}): Promise<boolean> {
  const {
    supabase,
    overlapCache,
    clientId,
    startISO,
    endISO,
    capacity,
    staffId,
  } = args;

  const day = new Date(startISO);
  day.setUTCHours(0, 0, 0, 0);

  const windowStart = new Date(day);
  const windowEnd = new Date(day);
  windowEnd.setUTCHours(23, 59, 59, 999);

  const windowStartISO = windowStart.toISOString();
  const windowEndISO = windowEnd.toISOString();

  await prefetchOverlaps(
    supabase,
    overlapCache,
    clientId,
    staffId ?? null,
    windowStartISO,
    windowEndISO
  );

  const key = makeOverlapKey(
    clientId,
    staffId ?? null,
    windowStartISO,
    windowEndISO
  );

  const existing = overlapCache.get(key) ?? [];
  const overlapCount = countOverlapsInIntervals(existing, startISO, endISO);

  return overlapCount < capacity;
}