import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import type { LineStringGeometry } from "@/lib/osrm";
import { getDrivingRouteWithFallback } from "@/lib/routing-with-fallback";
import { resolveZone, roundNearest1000 } from "@/lib/pricing";

type CalculateBody = {
  city: "yangon" | "mandalay";
  location: { lat: number; lng: number };
  hubSelectionMode: "auto" | "manual";
  manualHubId?: string | null;
  geocodeProviderUsed?: string;
  inputAddress?: string | null;
  /** When true (default), OSRM returns route line for map drawing */
  includeRouteGeometry?: boolean;
};

type HubRow = {
  id: string;
  code: string;
  name: string;
  lat: number;
  lng: number;
};

function pickNearestHub(
  hubs: HubRow[],
  customerLat: number,
  customerLng: number,
): HubRow {
  let best = hubs[0];
  let bestDistance = Number.MAX_SAFE_INTEGER;
  for (const hub of hubs) {
    const d = Math.sqrt(
      (customerLat - hub.lat) ** 2 + (customerLng - hub.lng) ** 2,
    );
    if (d < bestDistance) {
      bestDistance = d;
      best = hub;
    }
  }
  return best;
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Project Settings → API → service_role).",
      },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as CalculateBody;
    if (!body?.city || !body?.location) {
      return NextResponse.json(
        { error: "city and location are required." },
        { status: 400 },
      );
    }

    const { data: cityRow, error: cityErr } = await supabase
      .from("cities")
      .select("id")
      .eq("code", body.city)
      .eq("is_active", true)
      .maybeSingle();

    if (cityErr || !cityRow) {
      return NextResponse.json({ error: "City not found." }, { status: 404 });
    }

    const { data: hubRows, error: hubsErr } = await supabase
      .from("service_hubs_with_coords")
      .select("id, code, name, lat, lng")
      .eq("city_id", cityRow.id)
      .eq("is_active", true);

    if (hubsErr || !hubRows?.length) {
      return NextResponse.json(
        {
          error:
            hubsErr?.message?.includes("service_hubs_with_coords") ||
            hubsErr?.code === "42P01"
              ? "Run supabase/03_service_hubs_with_coords_view.sql in Supabase SQL Editor."
              : "No active hubs for this city.",
        },
        { status: 500 },
      );
    }

    const hubs = hubRows as HubRow[];

    const selectedHub: HubRow | undefined =
      body.hubSelectionMode === "manual" && body.manualHubId
        ? hubs.find((h) => h.code === body.manualHubId || h.id === body.manualHubId)
        : pickNearestHub(hubs, body.location.lat, body.location.lng);

    if (!selectedHub) {
      return NextResponse.json(
        { error: "Hub not found for selected city." },
        { status: 400 },
      );
    }

    const includeGeometry = body.includeRouteGeometry !== false;
    const {
      distanceKm,
      routeGeometry,
      routeProvider,
    } = await getDrivingRouteWithFallback(
      body.city,
      selectedHub.lat,
      selectedHub.lng,
      body.location.lat,
      body.location.lng,
      includeGeometry,
    );

    const zoneName = resolveZone(distanceKm);

    const { data: zoneRow, error: zoneErr } = await supabase
      .from("zones")
      .select("id, name, code")
      .eq("city_id", cityRow.id)
      .eq("name", zoneName)
      .eq("is_active", true)
      .maybeSingle();

    if (zoneErr || !zoneRow) {
      return NextResponse.json(
        { error: "Zone configuration missing for this distance." },
        { status: 500 },
      );
    }

    const { data: pricingRow, error: pricingErr } = await supabase
      .from("pricing_rules")
      .select("id, base_fare_mmk, per_km_rate_mmk, rounding_strategy")
      .eq("city_id", cityRow.id)
      .eq("is_active", true)
      .maybeSingle();

    if (pricingErr || !pricingRow) {
      return NextResponse.json(
        { error: "Pricing rule not configured for this city." },
        { status: 500 },
      );
    }

    const { data: adjRow } = await supabase
      .from("zone_pricing_adjustments")
      .select("adjustment_mmk")
      .eq("city_id", cityRow.id)
      .eq("zone_id", zoneRow.id)
      .maybeSingle();

    const zoneAdjustmentMmk = Number(adjRow?.adjustment_mmk ?? 0);
    const baseFareMmk = Number(pricingRow.base_fare_mmk);
    const perKmRateMmk = Number(pricingRow.per_km_rate_mmk);

    const rawFeeMmk =
      baseFareMmk + distanceKm * perKmRateMmk + zoneAdjustmentMmk;
    const finalFeeMmk = roundNearest1000(rawFeeMmk);

    const geocodeProvider = body.geocodeProviderUsed ?? "nominatim";

    const lng = body.location.lng;
    const lat = body.location.lat;
    const ewkt = `SRID=4326;POINT(${lng} ${lat})`;

    let logErr = (
      await supabase.from("calculation_logs").insert({
        city_id: cityRow.id,
        input_address: body.inputAddress ?? null,
        input_location: ewkt,
        selected_geocode_candidate: null,
        selected_hub_id: selectedHub.id,
        hub_selection_mode: body.hubSelectionMode,
        distance_km: distanceKm,
        zone_id: zoneRow.id,
        base_fare_mmk: baseFareMmk,
        per_km_rate_mmk: perKmRateMmk,
        zone_adjustment_mmk: zoneAdjustmentMmk,
        raw_fee_mmk: rawFeeMmk,
        final_fee_mmk: finalFeeMmk,
        rounding_rule: pricingRow.rounding_strategy ?? "nearest_1000",
        geocode_provider_used: geocodeProvider,
        route_provider_used: routeProvider,
        status: "success",
        error_message: null,
      })
    ).error;

    if (logErr) {
      console.error("calculation_logs insert (EWKT):", logErr);
      const rpc = await supabase.rpc("insert_calculation_log", {
        p_city_id: cityRow.id,
        p_input_address: body.inputAddress ?? null,
        p_lng: lng,
        p_lat: lat,
        p_selected_hub_id: selectedHub.id,
        p_hub_selection_mode: body.hubSelectionMode,
        p_distance_km: distanceKm,
        p_zone_id: zoneRow.id,
        p_base_fare_mmk: baseFareMmk,
        p_per_km_rate_mmk: perKmRateMmk,
        p_zone_adjustment_mmk: zoneAdjustmentMmk,
        p_raw_fee_mmk: rawFeeMmk,
        p_final_fee_mmk: finalFeeMmk,
        p_rounding_rule: pricingRow.rounding_strategy ?? "nearest_1000",
        p_geocode_provider: geocodeProvider,
        p_route_provider: routeProvider,
      });
      logErr = rpc.error ?? null;
      if (logErr) {
        console.error("calculation_logs RPC:", logErr);
      }
    }

    const json: {
      selectedHub: { id: string; name: string };
      distanceKm: number;
      zone: { id: string; name: string };
      pricing: {
        baseFareMmk: number;
        perKmRateMmk: number;
        zoneAdjustmentMmk: number;
        rawFeeMmk: number;
        finalFeeMmk: number;
        roundingRule: string;
      };
      providers: { geocode: string; route: string };
      routeGeometry: LineStringGeometry | null;
      logged: boolean;
      logError?: string;
    } = {
      selectedHub: { id: selectedHub.code, name: selectedHub.name },
      distanceKm,
      zone: { id: zoneRow.code, name: zoneRow.name },
      pricing: {
        baseFareMmk,
        perKmRateMmk,
        zoneAdjustmentMmk,
        rawFeeMmk,
        finalFeeMmk,
        roundingRule: pricingRow.rounding_strategy ?? "nearest_1000",
      },
      providers: {
        geocode: geocodeProvider,
        route: routeProvider,
      },
      routeGeometry: includeGeometry ? routeGeometry : null,
      logged: !logErr,
      logError: logErr
        ? (logErr as { message?: string }).message ?? String(logErr)
        : undefined,
    };

    return NextResponse.json(json);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to calculate transport fee.",
      },
      { status: 500 },
    );
  }
}
