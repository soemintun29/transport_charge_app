import { NextRequest, NextResponse } from "next/server";
import {
  isInServiceArea,
  isNominatimHitValidForCity,
  type NominatimHit,
} from "@/lib/geo-validation";
import { googleGeocodeSearch } from "@/lib/google-geocode";
import { isGoogleFallbackAllowed } from "@/lib/google-fallback-policy";
import { tryConsumeGoogleApiSlot } from "@/lib/google-quota";
import { logGoogleApiUsage } from "@/lib/google-usage-log";
import {
  readGeocodeCache,
  writeGeocodeCache,
  type GeocodePayload,
} from "./geocode-cache";
import { searchNominatimHits } from "./nominatim";

function hasGoogleKey(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY?.trim());
}

function hitsToSuggestions(
  hits: NominatimHit[],
  city: "yangon" | "mandalay",
  limit = 3,
) {
  const valid = hits.filter((h) => isNominatimHitValidForCity(city, h));
  return valid.slice(0, limit).map((h) => ({
    displayAddress: h.display_name,
    lat: h.lat,
    lng: h.lng,
    score: h.importance,
    provider: "nominatim" as const,
  }));
}

function looseNominatimSuggestions(hits: NominatimHit[], limit = 3) {
  return hits.slice(0, limit).map((h) => ({
    displayAddress: h.display_name,
    lat: h.lat,
    lng: h.lng,
    score: h.importance,
    provider: "nominatim" as const,
  }));
}

export async function POST(request: NextRequest) {
  try {
    const { address, city } = await request.json();
    if (!address || typeof address !== "string") {
      return NextResponse.json(
        { error: "Address is required." },
        { status: 400 },
      );
    }

    if (city !== "yangon" && city !== "mandalay") {
      return NextResponse.json({ error: "Invalid city." }, { status: 400 });
    }

    const normalized = address.trim().toLowerCase();
    const cached = await readGeocodeCache(normalized, city);
    if (cached) {
      return NextResponse.json(cached);
    }

    const nom = await searchNominatimHits(address, city);

    if (!nom.ok) {
      if (nom.reason === "rate_limited") {
        return NextResponse.json(
          {
            error:
              "Geocoding is temporarily rate-limited. Wait 10–15 seconds and try again, or use the same wording as last time (cached in this session).",
          },
          { status: 429 },
        );
      }
      if (nom.reason === "unavailable") {
        return NextResponse.json(
          { error: "Geocoding provider is currently unavailable." },
          { status: 502 },
        );
      }
    }

    const nominatimHits = nom.ok ? nom.hits : [];
    let suggestions: GeocodePayload["suggestions"] = hitsToSuggestions(
      nominatimHits,
      city,
    );
    let cacheProvider: "nominatim" | "google" = "nominatim";

    const googleEnabled = await isGoogleFallbackAllowed();
    if (suggestions.length === 0 && googleEnabled && hasGoogleKey()) {
      const googleReason =
        nominatimHits.length === 0
          ? "geocode_no_results"
          : "geocode_all_invalid";

      const allowed = await tryConsumeGoogleApiSlot();
      if (!allowed) {
        logGoogleApiUsage({
          reason: googleReason,
          city,
          address: address.trim(),
          detail: "google_skipped_monthly_quota",
        });
      } else {
        const googleHits = await googleGeocodeSearch(address, city);
        const filtered = googleHits.filter((g) =>
          isInServiceArea(city, g.lat, g.lng),
        );
        suggestions = filtered.slice(0, 3).map((g) => ({
          displayAddress: g.displayAddress,
          lat: g.lat,
          lng: g.lng,
          score: g.score,
          provider: "google" as const,
        }));

        logGoogleApiUsage({
          reason: googleReason,
          city,
          address: address.trim(),
          detail:
            suggestions.length > 0
              ? "google_geocode_used"
              : "google_geocode_no_service_area_match",
        });

        if (suggestions.length > 0) {
          cacheProvider = "google";
        }
      }
    }

    if (suggestions.length === 0 && nominatimHits.length > 0) {
      suggestions = looseNominatimSuggestions(nominatimHits);
      cacheProvider = "nominatim";
    }

    if (suggestions.length === 0) {
      return NextResponse.json(
        {
          error:
            "Address not found. Try a shorter query (street + ward), add a landmark, or use a map pin later.",
        },
        { status: 404 },
      );
    }

    const payload: GeocodePayload = {
      requiresSelection: true,
      suggestions,
    };

    await writeGeocodeCache(normalized, city, payload, cacheProvider);

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { error: "Invalid request payload." },
      { status: 400 },
    );
  }
}
