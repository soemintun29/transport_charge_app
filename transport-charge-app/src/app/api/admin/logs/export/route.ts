import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-guard";
import { createServerSupabase } from "@/lib/supabase-server";

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

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

  const city = request.nextUrl.searchParams.get("city");
  const maxRows = 5000;

  let q = supabase
    .from("calculation_logs")
    .select(
      `
      id,
      request_time,
      city_id,
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
      route_provider_used,
      selected_hub_id,
      zone_id
    `,
    )
    .order("request_time", { ascending: false })
    .limit(maxRows);

  if (city === "yangon" || city === "mandalay") {
    const { data: c } = await supabase
      .from("cities")
      .select("id")
      .eq("code", city)
      .single();
    if (c) q = q.eq("city_id", c.id);
  }

  const { data: logs, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: cities } = await supabase.from("cities").select("id, code");
  const { data: hubs } = await supabase.from("service_hubs").select("id, code, name");
  const { data: zones } = await supabase.from("zones").select("id, name, code");

  const cityCode = Object.fromEntries((cities ?? []).map((x) => [x.id, x.code]));
  const hubLabel = Object.fromEntries(
    (hubs ?? []).map((x) => [x.id, `${x.name} (${x.code})`]),
  );
  const zoneLabel = Object.fromEntries(
    (zones ?? []).map((x) => [x.id, x.name]),
  );

  const headers = [
    "id",
    "request_time",
    "city",
    "input_address",
    "distance_km",
    "hub_selection_mode",
    "hub",
    "zone",
    "base_fare_mmk",
    "per_km_rate_mmk",
    "zone_adjustment_mmk",
    "raw_fee_mmk",
    "final_fee_mmk",
    "status",
    "geocode_provider",
    "route_provider",
  ];

  const lines = [headers.join(",")];
  for (const row of logs ?? []) {
    const r = row as Record<string, unknown>;
    const cityId = r.city_id as string;
    const hubId = r.selected_hub_id as string;
    const zoneId = r.zone_id as string;
    lines.push(
      [
        csvEscape(r.id as string),
        csvEscape(r.request_time as string),
        csvEscape(cityCode[cityId] ?? ""),
        csvEscape(r.input_address as string | null),
        csvEscape(r.distance_km as number),
        csvEscape(r.hub_selection_mode as string),
        csvEscape(hubLabel[hubId] ?? hubId),
        csvEscape(zoneLabel[zoneId] ?? zoneId),
        csvEscape(r.base_fare_mmk as number),
        csvEscape(r.per_km_rate_mmk as number),
        csvEscape(r.zone_adjustment_mmk as number),
        csvEscape(r.raw_fee_mmk as number),
        csvEscape(r.final_fee_mmk as number),
        csvEscape(r.status as string),
        csvEscape(r.geocode_provider_used as string),
        csvEscape(r.route_provider_used as string),
      ].join(","),
    );
  }

  const csv = lines.join("\r\n");
  const filename = `calculation-logs-${city ?? "all"}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
