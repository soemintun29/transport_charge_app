import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing.");
  return url;
}

function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!key)
    throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (anon) is missing.");
  return key;
}

export async function createAdminAuthServerClient() {
  const jar = await cookies();
  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (toSet) => {
        for (const { name, value, options } of toSet) {
          jar.set(name, value, options);
        }
      },
    },
  });
}

export function adminSupabaseAuthEnabled(): boolean {
  return process.env.ADMIN_SUPABASE_AUTH_ENABLED === "true";
}

export function parseAdminEmailAllowlist(): string[] {
  const raw = process.env.ADMIN_EMAIL_ALLOWLIST ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowlistedAdminEmail(email: string | undefined): boolean {
  if (!email) return false;
  const allowlist = parseAdminEmailAllowlist();
  if (allowlist.length === 0) return true; // if unset, allow any signed-in user (not recommended)
  return allowlist.includes(email.toLowerCase());
}

