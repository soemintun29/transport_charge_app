import { NextRequest, NextResponse } from "next/server";
import { createAnonSupabase } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city");
  if (city !== "yangon" && city !== "mandalay") {
    return NextResponse.json(
      { error: "Query city must be yangon or mandalay." },
      { status: 400 },
    );
  }

  const supabase = createAnonSupabase();
  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
      },
      { status: 503 },
    );
  }

  const { data: cityRow, error: cityErr } = await supabase
    .from("cities")
    .select("id")
    .eq("code", city)
    .eq("is_active", true)
    .maybeSingle();

  if (cityErr || !cityRow) {
    return NextResponse.json(
      { error: "City not found in database." },
      { status: 404 },
    );
  }

  const { data: hubs, error: hubsErr } = await supabase
    .from("service_hubs_with_coords")
    .select("id, code, name, lat, lng")
    .eq("city_id", cityRow.id)
    .eq("is_active", true)
    .order("name");

  if (hubsErr) {
    return NextResponse.json(
      {
        error:
          hubsErr.message.includes("service_hubs_with_coords") ||
          hubsErr.code === "42P01"
            ? "Run supabase/03_service_hubs_with_coords_view.sql in Supabase SQL Editor."
            : hubsErr.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { hubs: hubs ?? [] },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
