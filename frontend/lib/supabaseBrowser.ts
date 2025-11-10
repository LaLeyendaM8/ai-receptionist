// frontend/lib/supabaseBrowser.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Nur im Browser benutzen!
if (typeof window === 'undefined') {
  // kein throw, damit beim (versehentlichen) Server-Import nicht alles crasht
  // aber Hinweis im Log:
  console.warn('[supabaseBrowser] imported on server – use only in client components.')
}

let client: SupabaseClient | null = null

export function createBrowserClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  )
}

// Für bestehenden Code: benannter Export `supabaseBrowser`
export const supabaseBrowser: SupabaseClient = client ??= createBrowserClient()
