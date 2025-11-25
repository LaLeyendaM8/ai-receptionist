// frontend/lib/supabaseServer.ts
import { createServerClient } from "@supabase/ssr";
import { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export type TypedSupabaseClient = SupabaseClient;

export async function createServerClientTyped() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Kann ignoriert werden – Next setzt hier Grenzen
          }
        },
      },
    }
  );
}
