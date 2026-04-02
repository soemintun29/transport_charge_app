import { createServerSupabase } from "@/lib/supabase-server";

function currentYearMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function parseMonthlyLimit(): number | null {
  const raw = process.env.GOOGLE_MONTHLY_LIMIT?.trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

/** Production (or explicit flag): monthly cap must use DB RPC — no in-memory fallback. */
function quotaRequiresDatabase(): boolean {
  if (process.env.GOOGLE_QUOTA_REQUIRE_DB === "true") return true;
  return process.env.NODE_ENV === "production";
}

/**
 * If GOOGLE_MONTHLY_LIMIT is unset → unlimited (returns true).
 * If set → consume one slot via Supabase RPC. In development, falls back to in-memory
 * counting only when the DB is unavailable; in production, missing RPC/Supabase blocks Google.
 */
let memoryMonth = "";
let memoryCount = 0;

export async function tryConsumeGoogleApiSlot(): Promise<boolean> {
  const limit = parseMonthlyLimit();
  if (limit == null) return true;

  const ym = currentYearMonth();
  const strict = quotaRequiresDatabase();
  const supabase = createServerSupabase();

  if (!supabase) {
    if (strict) {
      console.error(
        "[google-quota] GOOGLE_MONTHLY_LIMIT is set but Supabase service client is missing; blocking Google in strict mode.",
      );
      return false;
    }
    console.warn(
      "[google-quota] No Supabase service client; memory fallback for monthly limit.",
    );
  } else {
    const { data, error } = await supabase.rpc("consume_google_api_quota", {
      p_year_month: ym,
      p_max: limit,
    });
    if (!error && typeof data === "boolean") {
      return data;
    }
    if (strict) {
      console.error(
        "[google-quota] consume_google_api_quota RPC failed; blocking Google in strict mode. Apply supabase/06_google_api_monthly_usage.sql and check SUPABASE_SERVICE_ROLE_KEY.",
        error?.message ?? error,
      );
      return false;
    }
    console.warn(
      "[google-quota] RPC consume_google_api_quota failed; using memory fallback. Run supabase/06_google_api_monthly_usage.sql for accurate caps.",
      error?.message ?? error,
    );
  }

  if (memoryMonth !== ym) {
    memoryMonth = ym;
    memoryCount = 0;
  }
  if (memoryCount >= limit) return false;
  memoryCount += 1;
  return true;
}
