/**
 * Nominatim public API: ~1 req/s per policy. Cache repeat queries; throttle outbound calls.
 * https://operations.osmfoundation.org/policies/nominatim/
 */

import type { NominatimHit } from "@/lib/geo-validation";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const MIN_INTERVAL_MS = 1100;

type CachedHits = { hits: NominatimHit[] };

const hitsCache = new Map<string, { expiresAt: number; payload: CachedHits }>();

let lastNominatimCall = 0;

function cacheKey(address: string, city: string) {
  return `${city}:${address.trim().toLowerCase()}`;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function throttle() {
  const now = Date.now();
  const wait = lastNominatimCall + MIN_INTERVAL_MS - now;
  if (wait > 0) await sleep(wait);
  lastNominatimCall = Date.now();
}

type NominatimApiResult = {
  display_name: string;
  lat: string;
  lon: string;
  importance?: number;
  class?: string;
  type?: string;
  address?: Record<string, string>;
};

export async function searchNominatimHits(
  address: string,
  city: "yangon" | "mandalay",
): Promise<
  | { ok: true; hits: NominatimHit[] }
  | { ok: false; reason: "not_found" | "rate_limited" | "unavailable" }
> {
  const key = cacheKey(address, city);
  const hit = hitsCache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return { ok: true, hits: hit.payload.hits };
  }

  const cityText = city === "mandalay" ? "Mandalay" : "Yangon";
  const query = encodeURIComponent(`${address}, ${cityText}, Myanmar`);
  const base =
    process.env.NOMINATIM_BASE_URL ?? "https://nominatim.openstreetmap.org";
  const url = `${base}/search?format=jsonv2&q=${query}&limit=5&countrycodes=mm`;
  const userAgent =
    process.env.NOMINATIM_USER_AGENT ??
    "TransportChargeApp/1.0 (home-service transport; +https://github.com/)";

  await throttle();

  const response = await fetch(url, {
    headers: {
      "User-Agent": userAgent,
      Accept: "application/json",
      "Accept-Language": "en",
    },
    cache: "no-store",
  });

  if (response.status === 429) {
    return { ok: false, reason: "rate_limited" };
  }

  if (!response.ok) {
    return { ok: false, reason: "unavailable" };
  }

  const data = (await response.json()) as NominatimApiResult[];
  const hits: NominatimHit[] = data.slice(0, 5).map((item) => ({
    display_name: item.display_name,
    lat: Number(item.lat),
    lng: Number(item.lon),
    importance: item.importance ?? 0.35,
    class: item.class,
    type: item.type,
    address: item.address,
  }));

  if (hits.length === 0) {
    return { ok: false, reason: "not_found" };
  }

  hitsCache.set(key, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    payload: { hits },
  });

  return { ok: true, hits };
}
