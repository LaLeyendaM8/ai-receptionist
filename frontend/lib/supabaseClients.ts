// frontend/lib/supabaseClients.ts
import "server-only";
import { createServerClientTyped, type TypedSupabaseClient } from "./supabaseServer";
import { createClient } from "@supabase/supabase-js";

export async function createClients(): Promise<TypedSupabaseClient> {
  return await createServerClientTyped();
}

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase service role config missing");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}