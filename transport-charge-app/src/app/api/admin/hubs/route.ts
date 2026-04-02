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
  const city = request.nextUrl.searchParams.get("city");
  let q = supabase
    .from("service_hubs_with_coords")
    .select("id, city_id, code, name, address_text, lat, lng, is_active")
    .order("code");
  if (city === "yangon" || city === "mandalay") {
    const { data: c } = await supabase
      .from("cities")
      .select("id")
      .eq("code", city)
      .single();
    if (c) q = q.eq("city_id", c.id);
  }
  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ hubs: data ?? [] });
}
