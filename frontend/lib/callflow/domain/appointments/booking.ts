import type { SupabaseClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";

export function localDateTimeToUTCISO(dateStr: string, timeStr: string, tz: string) {
  const dt = DateTime.fromISO(`${dateStr}T${timeStr}:00`, { zone: tz });
  if (!dt.isValid) return null;
  return dt.toUTC().toISO({ suppressMilliseconds: true });
}

export async function createAppointmentDraft(args: {
  supabase: SupabaseClient;
  clientId: string;
  title: string;
  startAt: string;
  endAt: string;
  customerName?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
  staffId?: string | null;
}) {
  const {
    supabase,
    clientId,
    title,
    startAt,
    endAt,
    customerName,
    customerPhone,
    notes,
    staffId,
  } = args;

  const { data, error } = await supabase
    .from("appointment_drafts")
    .insert({
      client_id: clientId,
      title,
      start_at: startAt,
      end_at: endAt,
      customer_name: customerName ?? null,
      customer_phone: customerPhone ?? null,
      notes: notes ?? "",
      staff_id: staffId ?? null,
    })
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function loadAppointmentDraft(args: {
  supabase: SupabaseClient;
  clientId: string;
  draftId?: string | null;
}) {
  const { supabase, clientId, draftId } = args;

  let query = supabase
    .from("appointment_drafts")
    .select("*")
    .eq("client_id", clientId);

  if (draftId) {
    query = query.eq("id", draftId);
  } else {
    query = query.order("created_at", { ascending: false }).limit(1);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteAppointmentDraft(
  supabase: SupabaseClient,
  draftId: string
) {
  const { error } = await supabase
    .from("appointment_drafts")
    .delete()
    .eq("id", draftId);

  if (error) throw error;
}

export async function createAppointmentFromDraft(args: {
  supabase: SupabaseClient;
  clientId: string;
  draft: any;
}) {
  const { supabase, clientId, draft } = args;

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      client_id: clientId,
      title: draft.title ?? "Termin",
      start_at: draft.start_at,
      end_at: draft.end_at,
      status: "booked",
      source: "ai",
      notes: draft.notes ?? "",
      staff_id: draft.staff_id ?? null,
      customer_name: draft.customer_name ?? null,
      customer_phone: draft.customer_phone ?? null,
    })
    .select()
    .limit(1);

  if (error) throw error;
  if (!data?.[0]) throw new Error("appointment_insert_failed");

  return data[0];
}

export async function findUpcomingAppointmentByCustomer(args: {
  supabase: SupabaseClient;
  clientId: string;
  customerName?: string | null;
  customerPhone?: string | null;
}) {
  const { supabase, clientId, customerName, customerPhone } = args;

  const nowISO = new Date().toISOString();

  let query = supabase
    .from("appointments")
    .select("*")
    .eq("client_id", clientId)
    .neq("status", "cancelled")
    .gte("start_at", nowISO);

  if (customerName) query = query.eq("customer_name", customerName);
  if (customerPhone) query = query.eq("customer_phone", customerPhone);

  const { data, error } = await query
    .order("start_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function findAppointmentByExactStart(args: {
  supabase: SupabaseClient;
  clientId: string;
  startAt: string;
  customerName: string;
}) {
  const { supabase, clientId, startAt, customerName } = args;

  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("client_id", clientId)
    .neq("status", "cancelled")
    .eq("start_at", startAt)
    .eq("customer_name", customerName)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function cancelAppointmentById(
  supabase: SupabaseClient,
  appointmentId: string
) {
  const { data, error } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appointmentId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function rescheduleAppointmentById(args: {
  supabase: SupabaseClient;
  appointmentId: string;
  startAt: string;
  endAt: string;
}) {
  const { supabase, appointmentId, startAt, endAt } = args;

  const { data, error } = await supabase
    .from("appointments")
    .update({ start_at: startAt, end_at: endAt })
    .eq("id", appointmentId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function setAppointmentGoogleEventId(args: {
  supabase: SupabaseClient;
  appointmentId: string;
  googleEventId: string;
}) {
  const { supabase, appointmentId, googleEventId } = args;

  const { error } = await supabase
    .from("appointments")
    .update({ google_event_id: googleEventId })
    .eq("id", appointmentId);

  if (error) throw error;
}