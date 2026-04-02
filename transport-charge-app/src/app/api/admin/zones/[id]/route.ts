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

  const name = typeof body.name === "string" ? body.name : undefined;
  const min_distance_km =
    typeof body.min_distance_km === "number" ? body.min_distance_km : undefined;
  const max_distance_km =
    typeof body.max_distance_km === "number" ? body.max_distance_km : undefined;
  const is_active =
    typeof body.is_active === "boolean" ? body.is_active : undefined;
  const adjustment_mmk =
    typeof body.adjustment_mmk === "number" ? body.adjustment_mmk : undefined;

  const zoneUpdates: Record<string, unknown> = {};
  if (name !== undefined) zoneUpdates.name = name;
  if (min_distance_km !== undefined) zoneUpdates.min_distance_km = min_distance_km;
  if (max_distance_km !== undefined) zoneUpdates.max_distance_km = max_distance_km;
  if (is_active !== undefined) zoneUpdates.is_active = is_active;

  if (Object.keys(zoneUpdates).length > 0) {
    const { error } = await supabase
      .from("zones")
      .update(zoneUpdates)
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (adjustment_mmk !== undefined) {
    const { data: zone } = await supabase
      .from("zones")
      .select("city_id")
      .eq("id", id)
      .single();
    if (!zone) {
      return NextResponse.json({ error: "Zone not found." }, { status: 404 });
    }
    const { data: existing } = await supabase
      .from("zone_pricing_adjustments")
      .select("id")
      .eq("city_id", zone.city_id)
      .eq("zone_id", id)
      .maybeSingle();
    const row = {
      city_id: zone.city_id,
      zone_id: id,
      adjustment_mmk,
    };
    const { error: upErr } = existing
      ? await supabase
          .from("zone_pricing_adjustments")
          .update({ adjustment_mmk })
          .eq("id", existing.id)
      : await supabase.from("zone_pricing_adjustments").insert(row);
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
