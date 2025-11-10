// frontend/lib/supabaseClients.ts
import { createClient } from '@supabase/supabase-js'



export function createClients() {
  // Browser-Client (RLS enforced)
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  return { supabase }
}
