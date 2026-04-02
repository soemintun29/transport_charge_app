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

  const limit = Math.min(
    100,
    Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 40),
  );
  const offset = Math.max(0, Number(request.nextUrl.searchParams.get("offset")) || 0);
  const city = request.nextUrl.searchParams.get("city");

  let q = supabase
    .from("calculation_logs")
    .select(
      `
      id,
      request_time,
      city_id,
      selected_hub_id,
      zone_id,
      input_address,
      distance_km,
      hub_selection_mode,
      base_fare_mmk,
      per_km_rate_mmk,
      zone_adjustment_mmk,
      raw_fee_mmk,
      final_fee_mmk,
      status,
      geocode_provider_used,
      route_provider_used
    `,
      { count: "exact" },
    )
    .order("request_time", { ascending: false })
    .range(offset, offset + limit - 1);

  if (city === "yangon" || city === "mandalay") {
    const { data: c } = await supabase
      .from("cities")
      .select("id")
      .eq("code", city)
      .single();
    if (c) q = q.eq("city_id", c.id);
  }

  const { data: logs, error, count } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: cities } = await supabase.from("cities").select("id, code");
  const { data: hubs } = await supabase.from("service_hubs").select("id, name, code");
  const { data: zones } = await supabase.from("zones").select("id, name, code");

  const cityCode = Object.fromEntries((cities ?? []).map((x) => [x.id, x.code]));
  const hubName = Object.fromEntries(
    (hubs ?? []).map((x) => [x.id, { name: x.name, code: x.code }]),
  );
  const zoneName = Object.fromEntries(
    (zones ?? []).map((x) => [x.id, { name: x.name, code: x.code }]),
  );

  const enriched = (logs ?? []).map((row: Record<string, unknown>) => {
    const cityId = row.city_id as string;
    const hubId = row.selected_hub_id as string;
    const zoneId = row.zone_id as string;
    const h = hubName[hubId];
    const z = zoneName[zoneId];
    return {
      ...row,
      city_code: cityCode[cityId] ?? "",
      hub_label: h ? `${h.name} (${h.code})` : hubId,
      zone_label: z ? `${z.name}` : zoneId,
    };
  });

  return NextResponse.json({ logs: enriched, total: count ?? 0 });
}
