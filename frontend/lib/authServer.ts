// lib/authServer.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "./supabaseServer";

export async function getCurrentUserId(
  _existingClient?: SupabaseClient
): Promise<string | null> {
  // DEV-Modus: hart auf DEV_USER_ID gehen
  if (process.env.ENABLE_TEST === "true" && process.env.DEV_USER_ID) {
    return process.env.DEV_USER_ID;
  }

  // Produktmodus: echten Supabase-User aus Cookies holen
  const supabase = _existingClient ?? (await createServerClient());

  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) return null;
  return data.user.id;
}
