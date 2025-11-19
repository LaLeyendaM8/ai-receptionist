// frontend/lib/supabaseServer.ts
import { cookies } from "next/headers";
import {
  createServerClient as createSupabaseServerClientInternal,
  type CookieOptions,
} from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";


export async function createServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies(); // NEXT 14 FIX

  return createSupabaseServerClientInternal(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );
}
