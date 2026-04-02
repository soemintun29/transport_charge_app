export type CityPricing = {
  baseFareMmk: number;
  perKmRateMmk: number;
  zoneAdjustments: Record<string, number>;
};

export const CITY_PRICING: Record<"yangon" | "mandalay", CityPricing> = {
  yangon: {
    baseFareMmk: 10000,
    perKmRateMmk: 4000,
    zoneAdjustments: {
      "Zone A": 0,
      "Zone B": 2000,
      "Zone C": 6000,
      "Zone D": 10000,
    },
  },
  mandalay: {
    baseFareMmk: 10000,
    perKmRateMmk: 3500,
    zoneAdjustments: {
      "Zone A": 0,
      "Zone B": 2000,
      "Zone C": 5000,
      "Zone D": 9000,
    },
  },
};

export function resolveZone(distanceKm: number): string {
  if (distanceKm <= 5) return "Zone A";
  if (distanceKm <= 10) return "Zone B";
  if (distanceKm <= 20) return "Zone C";
  return "Zone D";
}

export function roundNearest1000(amount: number): number {
  return Math.round(amount / 1000) * 1000;
}
