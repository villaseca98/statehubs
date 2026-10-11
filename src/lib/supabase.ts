import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

// Without these two variables StateHubs runs in guest mode: every app lives
// in this browser and nothing needs a server.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const hasServer = !!(url && key);
export const supabase: SupabaseClient | null = hasServer
  ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

export function server(): SupabaseClient {
  if (!supabase) throw new Error('Sin servidor: estás en modo prueba.');
  return supabase;
}
