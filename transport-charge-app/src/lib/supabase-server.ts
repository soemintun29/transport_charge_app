import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server route client using the publishable (anon) key — respects RLS.
 * Use for public reads (e.g. hub list) that your policies allow.
 */
export function createAnonSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Server-only client with service role (bypasses RLS for inserts and protected reads).
 * Set SUPABASE_SERVICE_ROLE_KEY in .env.local — never expose to the browser.
 */
export function createServerSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
