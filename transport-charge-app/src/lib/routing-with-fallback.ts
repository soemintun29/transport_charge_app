import { isOsrmDistanceInvalid } from "@/lib/geo-validation";
import { googleDrivingDistanceKm } from "@/lib/google-distance";
import { isGoogleFallbackAllowed } from "@/lib/google-fallback-policy";
import { tryConsumeGoogleApiSlot } from "@/lib/google-quota";
import { logGoogleApiUsage } from "@/lib/google-usage-log";
import {
  getDrivingRoute,
  type LineStringGeometry,
} from "@/lib/osrm";

export type RouteResult = {
  distanceKm: number;
  routeGeometry: LineStringGeometry | null;
  routeProvider: "osrm" | "google";
};

/**
 * OSRM first; if distance invalid or OSRM fails, optionally Google Distance Matrix.
 */
export async function getDrivingRouteWithFallback(
  city: "yangon" | "mandalay",
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  includeGeometry: boolean,
): Promise<RouteResult> {
  let distanceKm = NaN;
  let routeGeometry: LineStringGeometry | null = null;

  try {
    const osrm = await getDrivingRoute(
      fromLat,
      fromLng,
      toLat,
      toLng,
      includeGeometry,
    );
    distanceKm = osrm.distanceKm;
    routeGeometry = osrm.routeGeometry;
    if (!isOsrmDistanceInvalid(city, distanceKm)) {
      return {
        distanceKm,
        routeGeometry,
        routeProvider: "osrm",
      };
    }
  } catch {
    distanceKm = NaN;
    routeGeometry = null;
  }

  const googleEnabled = await isGoogleFallbackAllowed();
  if (!googleEnabled) {
    if (Number.isFinite(distanceKm) && distanceKm > 0) {
      return {
        distanceKm,
        routeGeometry,
        routeProvider: "osrm",
      };
    }
    throw new Error("No route found");
  }

  const allowed = await tryConsumeGoogleApiSlot();
  if (!allowed) {
    logGoogleApiUsage({
      reason: "distance_invalid",
      city,
      detail: "google_skipped_monthly_quota",
      routeEndpoints: {
        from: { lat: fromLat, lng: fromLng },
        to: { lat: toLat, lng: toLng },
      },
    });
    if (Number.isFinite(distanceKm) && distanceKm > 0) {
      return {
        distanceKm,
        routeGeometry,
        routeProvider: "osrm",
      };
    }
    throw new Error("No route found");
  }

  const gKm = await googleDrivingDistanceKm(
    fromLat,
    fromLng,
    toLat,
    toLng,
  );

  logGoogleApiUsage({
    reason: "distance_invalid",
    city,
    routeEndpoints: {
      from: { lat: fromLat, lng: fromLng },
      to: { lat: toLat, lng: toLng },
    },
    detail:
      gKm != null && !isOsrmDistanceInvalid(city, gKm)
        ? "google_distance_used"
        : gKm != null
          ? "google_distance_still_invalid"
          : "google_distance_failed",
  });

  if (gKm != null && !isOsrmDistanceInvalid(city, gKm)) {
    return {
      distanceKm: gKm,
      routeGeometry: null,
      routeProvider: "google",
    };
  }

  if (Number.isFinite(distanceKm) && distanceKm > 0) {
    return {
      distanceKm,
      routeGeometry,
      routeProvider: "osrm",
    };
  }

  throw new Error("No route found");
}
