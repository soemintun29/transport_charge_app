import { createServerSupabase } from "@/lib/supabase-server";

const CACHE_DAYS = 30;

export type GeocodePayload = {
  requiresSelection: true;
  suggestions: Array<{
    displayAddress: string;
    lat: number;
    lng: number;
    score: number;
    provider: string;
  }>;
};

export async function readGeocodeCache(
  normalizedQuery: string,
  cityCode: "yangon" | "mandalay",
): Promise<GeocodePayload | null> {
  const supabase = createServerSupabase();
  if (!supabase) return null;

  const { data: cityRow } = await supabase
    .from("cities")
    .select("id")
    .eq("code", cityCode)
    .maybeSingle();
  if (!cityRow) return null;

  const { data: row } = await supabase
    .from("geocode_cache")
    .select("result_json")
    .eq("query_text", normalizedQuery)
    .eq("city_id", cityRow.id)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row?.result_json) return null;
  const parsed = row.result_json as unknown;
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "suggestions" in parsed &&
    Array.isArray((parsed as GeocodePayload).suggestions)
  ) {
    return parsed as GeocodePayload;
  }
  return null;
}

export async function writeGeocodeCache(
  normalizedQuery: string,
  cityCode: "yangon" | "mandalay",
  payload: GeocodePayload,
  providerTag: "nominatim" | "google" = "nominatim",
): Promise<void> {
  const supabase = createServerSupabase();
  if (!supabase) return;

  const { data: cityRow } = await supabase
    .from("cities")
    .select("id")
    .eq("code", cityCode)
    .maybeSingle();
  if (!cityRow) return;

  const expiresAt = new Date(
    Date.now() + CACHE_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: existing } = await supabase
    .from("geocode_cache")
    .select("id")
    .eq("query_text", normalizedQuery)
    .eq("city_id", cityRow.id)
    .limit(1)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("geocode_cache")
      .update({
        result_json: payload,
        expires_at: expiresAt,
        provider: providerTag,
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("geocode_cache").insert({
      query_text: normalizedQuery,
      city_id: cityRow.id,
      provider: providerTag,
      result_json: payload,
      expires_at: expiresAt,
    });
  }
}
