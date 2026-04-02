const OSRM_DEFAULT = "https://router.project-osrm.org";

export type LineStringGeometry = {
  type: "LineString";
  coordinates: [number, number][]; // [lng, lat]
};

export async function getDrivingRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  includeGeometry: boolean,
): Promise<{ distanceKm: number; routeGeometry: LineStringGeometry | null }> {
  const osrmBase = process.env.OSRM_BASE_URL ?? OSRM_DEFAULT;
  const query = includeGeometry
    ? "overview=full&geometries=geojson"
    : "overview=false";
  const url = `${osrmBase}/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?${query}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("Routing provider error");
  const data = (await response.json()) as {
    routes?: Array<{
      distance: number;
      geometry?: LineStringGeometry | { type: string; coordinates?: unknown };
    }>;
  };
  const route = data.routes?.[0];
  if (!route?.distance) throw new Error("No route found");
  const distanceKm = route.distance / 1000;
  let routeGeometry: LineStringGeometry | null = null;
  if (
    includeGeometry &&
    route.geometry?.type === "LineString" &&
    Array.isArray(route.geometry.coordinates)
  ) {
    routeGeometry = route.geometry as LineStringGeometry;
  }
  return { distanceKm, routeGeometry };
}
