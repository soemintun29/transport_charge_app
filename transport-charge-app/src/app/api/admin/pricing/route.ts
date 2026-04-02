import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-guard";
import { createServerSupabase } from "@/lib/supabase-server";

export async function GET() {
  const denied = await assertAdmin();
  if (denied) return denied;
  const supabase = createServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY missing." },
      { status: 503 },
    );
  }
  const { data: rules, error } = await supabase
    .from("pricing_rules")
    .select("id, city_id, base_fare_mmk, per_km_rate_mmk, rounding_strategy, is_active")
    .eq("is_active", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: cities } = await supabase.from("cities").select("id, code, name");
  const cityById = Object.fromEntries((cities ?? []).map((c) => [c.id, c]));

  const rows = (rules ?? []).map((r) => ({
    ...r,
    city: cityById[r.city_id] ?? null,
  }));

  return NextResponse.json({ rules: rows });
}
