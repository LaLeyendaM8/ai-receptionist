// frontend/lib/supabaseClients.ts
import { createServerClientTyped, type TypedSupabaseClient } from "./supabaseServer";

export async function createClients(): Promise<TypedSupabaseClient> {
  return await createServerClientTyped();
}
