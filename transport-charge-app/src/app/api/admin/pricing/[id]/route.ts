import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-guard";
import { createServerSupabase } from "@/lib/supabase-server";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await assertAdmin();
  if (denied) return denied;
  const supabase = createServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY missing." },
      { status: 503 },
    );
  }
  const { id } = await context.params;
  const body = await request.json();
  const base_fare_mmk =
    typeof body.base_fare_mmk === "number" ? body.base_fare_mmk : undefined;
  const per_km_rate_mmk =
    typeof body.per_km_rate_mmk === "number" ? body.per_km_rate_mmk : undefined;

  const updates: Record<string, unknown> = {};
  if (base_fare_mmk !== undefined) updates.base_fare_mmk = base_fare_mmk;
  if (per_km_rate_mmk !== undefined) updates.per_km_rate_mmk = per_km_rate_mmk;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields." }, { status: 400 });
  }

  const { error } = await supabase
    .from("pricing_rules")
    .update(updates)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
