import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-guard";
import { createServerSupabase } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const denied = await assertAdmin();
  if (denied) return denied;
  const supabase = createServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY missing." },
      { status: 503 },
    );
  }
  const cityFilter = request.nextUrl.searchParams.get("city");

  const { data: cities } = await supabase.from("cities").select("id, code");
  const cityCodeById = Object.fromEntries(
    (cities ?? []).map((c) => [c.id, c.code]),
  );

  let q = supabase
    .from("zones")
    .select(
      "id, city_id, code, name, min_distance_km, max_distance_km, is_active",
    )
    .order("min_distance_km");

  if (cityFilter === "yangon" || cityFilter === "mandalay") {
    const row = cities?.find((c) => c.code === cityFilter);
    if (row) q = q.eq("city_id", row.id);
  }

  const { data: zones, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: adjustments, error: adjErr } = await supabase
    .from("zone_pricing_adjustments")
    .select("zone_id, city_id, adjustment_mmk");

  if (adjErr) {
    return NextResponse.json({ error: adjErr.message }, { status: 500 });
  }

  const adjMap = new Map<string, number>();
  for (const a of adjustments ?? []) {
    adjMap.set(`${a.city_id}:${a.zone_id}`, Number(a.adjustment_mmk));
  }

  const rows = (zones ?? []).map((z) => ({
    ...z,
    city_code: cityCodeById[z.city_id] ?? "",
    adjustment_mmk: adjMap.get(`${z.city_id}:${z.id}`) ?? 0,
  }));

  return NextResponse.json({ zones: rows });
}
