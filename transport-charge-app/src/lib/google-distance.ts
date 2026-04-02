/**
 * Driving distance (km) via Google Distance Matrix API.
 */
export async function googleDrivingDistanceKm(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): Promise<number | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) return null;

  const origins = encodeURIComponent(`${fromLat},${fromLng}`);
  const dests = encodeURIComponent(`${toLat},${toLng}`);
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins}&destinations=${dests}&mode=driving&key=${key}`;

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return null;

  const data = (await response.json()) as {
    status: string;
    rows?: Array<{
      elements?: Array<{
        status: string;
        distance?: { value: number };
      }>;
    }>;
  };

  if (data.status !== "OK") return null;
  const el = data.rows?.[0]?.elements?.[0];
  if (!el || el.status !== "OK" || el.distance == null) return null;
  return el.distance.value / 1000;
}
