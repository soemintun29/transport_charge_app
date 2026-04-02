export type GoogleUsageReason =
  | "geocode_no_results"
  | "geocode_all_invalid"
  | "distance_invalid";

export function logGoogleApiUsage(payload: {
  reason: GoogleUsageReason;
  city?: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
  routeEndpoints?: {
    from: { lat: number; lng: number };
    to: { lat: number; lng: number };
  };
  detail?: string;
}) {
  const line = {
    tag: "GOOGLE_API_USAGE",
    time: new Date().toISOString(),
    ...payload,
  };
  console.info(JSON.stringify(line));
}
