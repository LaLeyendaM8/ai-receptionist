// frontend/lib/authServer.ts
import type { TypedSupabaseClient } from "./supabaseServer";

/**
 * Holt die userId aus Supabase-Auth.
 * Erwartet einen bereits erstellten Supabase-Client.
 */
export async function getCurrentUserId(
  supabase: TypedSupabaseClient
): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
      console.warn("[getCurrentUserId] auth.getUser error", error);
      return null;
    }

    return data.user.id;
  } catch (err) {
    console.error("[getCurrentUserId] unexpected error", err);
    return null;
  }
}
