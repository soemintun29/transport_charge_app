/** Approximate service bounding boxes (WGS84). */

const BOUNDS: Record<
  "yangon" | "mandalay",
  { minLat: number; maxLat: number; minLng: number; maxLng: number }
> = {
  yangon: {
    minLat: 16.65,
    maxLat: 17.12,
    minLng: 95.85,
    maxLng: 96.35,
  },
  mandalay: {
    minLat: 21.82,
    maxLat: 22.18,
    minLng: 95.82,
    maxLng: 96.28,
  },
};

export function isInServiceArea(
  city: "yangon" | "mandalay",
  lat: number,
  lng: number,
): boolean {
  const b = BOUNDS[city];
  return (
    lat >= b.minLat &&
    lat <= b.maxLat &&
    lng >= b.minLng &&
    lng <= b.maxLng
  );
}

const STREET_LIKE_KEYS = new Set([
  "road",
  "pedestrian",
  "footway",
  "path",
  "residential",
  "neighbourhood",
  "suburb",
  "quarter",
  "hamlet",
  "village",
  "township",
  "city_district",
  "municipality",
  "county",
  "district",
  "borough",
  "city_block",
  "residential_block",
  "house_number",
  "house_name",
  "building",
]);

/**
 * Nominatim hit is too generic for fee use if it is low importance and lacks
 * street / neighbourhood-level address parts.
 */
export function isNominatimHitTooGeneric(
  importance: number,
  address: Record<string, string> | undefined,
): boolean {
  let hasDetail = false;
  if (address) {
    for (const key of Object.keys(address)) {
      if (STREET_LIKE_KEYS.has(key)) {
        hasDetail = true;
        break;
      }
    }
  }
  if (hasDetail) return false;
  if (importance >= 0.38) return false;
  return true;
}

export type NominatimHit = {
  display_name: string;
  lat: number;
  lng: number;
  importance: number;
  class?: string;
  type?: string;
  address?: Record<string, string>;
};

export function isNominatimHitValidForCity(
  city: "yangon" | "mandalay",
  hit: NominatimHit,
): boolean {
  if (!isInServiceArea(city, hit.lat, hit.lng)) return false;
  if (isNominatimHitTooGeneric(hit.importance, hit.address)) return false;
  return true;
}

/** Max plausible one-way driving distance within metro (km). */
export function maxPlausibleRouteKm(city: "yangon" | "mandalay"): number {
  const y = Number(process.env.GOOGLE_MAX_ROUTE_KM_YANGON);
  const m = Number(process.env.GOOGLE_MAX_ROUTE_KM_MANDALAY);
  if (city === "yangon") {
    return Number.isFinite(y) && y > 0 ? y : 40;
  }
  return Number.isFinite(m) && m > 0 ? m : 45;
}

export function isOsrmDistanceInvalid(
  city: "yangon" | "mandalay",
  distanceKm: number | null | undefined,
): boolean {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return true;
  if (distanceKm <= 0) return true;
  if (distanceKm > maxPlausibleRouteKm(city)) return true;
  return false;
}
