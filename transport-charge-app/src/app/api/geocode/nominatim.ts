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

const CITY_CONTEXT: Record<
  "yangon" | "mandalay",
  {
    english: string;
    aliases: string[];
    viewbox: [number, number, number, number]; // left, top, right, bottom
  }
> = {
  yangon: {
    english: "Yangon",
    aliases: ["Rangoon", "ရန်ကုန်"],
    viewbox: [95.85, 17.12, 96.35, 16.65],
  },
  mandalay: {
    english: "Mandalay",
    aliases: ["မန္တလေး"],
    viewbox: [95.82, 22.18, 96.28, 21.82],
  },
};

function cacheKey(address: string, city: string) {
  return `${city}:${address.trim().toLowerCase()}`;
}

function buildQueryVariants(address: string, city: "yangon" | "mandalay"): string[] {
  const clean = address.trim().replace(/\s+/g, " ");
  const context = CITY_CONTEXT[city];
  const parts = [context.english, ...context.aliases];
  const variants = parts.map((name) => `${clean}, ${name}, Myanmar`);
  variants.push(`${clean}, Myanmar`);
  return [...new Set(variants)];
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

  const base =
    process.env.NOMINATIM_BASE_URL ?? "https://nominatim.openstreetmap.org";
  const cityCfg = CITY_CONTEXT[city];
  const [left, top, right, bottom] = cityCfg.viewbox;
  const staticParams = `format=jsonv2&limit=5&countrycodes=mm&addressdetails=1&accept-language=my,en&viewbox=${left},${top},${right},${bottom}&bounded=1`;
  const userAgent =
    process.env.NOMINATIM_USER_AGENT ??
    "TransportChargeApp/1.0 (home-service transport; +https://github.com/)";

  const queryVariants = buildQueryVariants(address, city);
  let collected: NominatimHit[] = [];
  for (const queryText of queryVariants) {
    await throttle();

    const query = encodeURIComponent(queryText);
    const url = `${base}/search?${staticParams}&q=${query}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": userAgent,
        Accept: "application/json",
        "Accept-Language": "my,en",
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
    collected = collected.concat(hits);
    if (collected.length >= 5) break;
  }

  const seen = new Set<string>();
  const hits = collected
    .filter((item) => {
      const key = `${item.lat.toFixed(6)}:${item.lng.toFixed(6)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5)
    .sort((a, b) => b.importance - a.importance);

  if (hits.length === 0) {
    return { ok: false, reason: "not_found" };
  }

  hitsCache.set(key, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    payload: { hits },
  });

  return { ok: true, hits };
}
