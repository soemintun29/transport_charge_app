export type GoogleGeocodeSuggestion = {
  displayAddress: string;
  lat: number;
  lng: number;
  score: number;
  provider: "google";
};

/**
 * Geocode with Google; bias to Myanmar. Returns up to 3 results.
 */
export async function googleGeocodeSearch(
  address: string,
  city: "yangon" | "mandalay",
): Promise<GoogleGeocodeSuggestion[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) return [];

  const region = city === "mandalay" ? "Mandalay" : "Yangon";
  const query = encodeURIComponent(`${address}, ${region}, Myanmar`);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${key}&region=mm`;

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return [];

  const data = (await response.json()) as {
    status: string;
    results?: Array<{
      formatted_address: string;
      geometry: { location: { lat: number; lng: number } };
      partial_match?: boolean;
    }>;
  };

  if (data.status !== "OK" || !data.results?.length) return [];

  return data.results.slice(0, 3).map((r, i) => ({
    displayAddress: r.formatted_address,
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    score: 0.95 - i * 0.02 - (r.partial_match ? 0.1 : 0),
    provider: "google" as const,
  }));
}
