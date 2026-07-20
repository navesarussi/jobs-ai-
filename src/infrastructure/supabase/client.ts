import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare global {
  // eslint-disable-next-line no-var
  var __shidukhSupabase: SupabaseClient | undefined;
}

export type SupabaseConfig = {
  url: string;
  publishableKey: string;
};

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

/** Browser-safe client (publishable key + RLS). */
export function createBrowserSupabase(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config) return null;
  return createClient(config.url, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

/** Server singleton — same publishable key; API routes already enforce auth. */
export function getServerSupabase(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config) return null;
  if (!global.__shidukhSupabase) {
    global.__shidukhSupabase = createClient(config.url, config.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return global.__shidukhSupabase;
}
