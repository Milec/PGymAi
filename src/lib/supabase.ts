import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when cloud sync is configured via env. When false, STRIDE runs fully local-first. */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * The Supabase client, or `null` when unconfigured. Everything that touches the
 * backend must null-check this so the app degrades gracefully to local-only.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
