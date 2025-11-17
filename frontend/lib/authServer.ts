import { createClients } from "./supabaseClients";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function getCurrentUserId(existingClient?: SupabaseClient
): Promise<string | null> {
    if (process.env.ENABLE_TEST === "true" && process.env.DEV_USER_ID) {
        return process.env.DEV_USER_ID;
    }

    const supabase = existingClient ?? createClients();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) return null;
    return data.user.id;
}