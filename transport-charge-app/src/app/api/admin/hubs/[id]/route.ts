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
  const address_text =
    typeof body.address_text === "string" ? body.address_text : undefined;
  const lat = typeof body.lat === "number" ? body.lat : undefined;
  const lng = typeof body.lng === "number" ? body.lng : undefined;
  const is_active =
    typeof body.is_active === "boolean" ? body.is_active : undefined;

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (address_text !== undefined) updates.address_text = address_text;
  if (is_active !== undefined) updates.is_active = is_active;
  if (lat !== undefined && lng !== undefined) {
    updates.location = `SRID=4326;POINT(${lng} ${lat})`;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("service_hubs")
    .update(updates)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Hub not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
