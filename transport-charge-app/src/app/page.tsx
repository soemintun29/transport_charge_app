"use client";

import dynamic from "next/dynamic";
import { FormEvent, useEffect, useState } from "react";
import { CITY_MAP_VIEW } from "@/lib/map-cities";

const CustomerMap = dynamic(() => import("@/components/CustomerMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[min(52vh,420px)] min-h-[240px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-600">
      Loading map…
    </div>
  ),
});

type Suggestion = {
  displayAddress: string;
  lat: number;
  lng: number;
  score: number;
  provider: string;
};

type FeeResult = {
  selectedHub: { id: string; name: string };
  distanceKm: number;
  zone: { id: string; name: string };
  pricing: {
    baseFareMmk: number;
    perKmRateMmk: number;
    zoneAdjustmentMmk: number;
    rawFeeMmk: number;
    finalFeeMmk: number;
    roundingRule: string;
  };
  providers: {
    geocode: string;
    route: string;
  };
  logged?: boolean;
  logError?: string;
  routeGeometry?: {
    type: string;
    coordinates: [number, number][];
  } | null;
};

export default function Home() {
  const [city, setCity] = useState<"yangon" | "mandalay">("yangon");
  const [address, setAddress] = useState("");
  const [hubMode, setHubMode] = useState<"auto" | "manual">("auto");
  const [manualHub, setManualHub] = useState("");
  const [hubOptions, setHubOptions] = useState<{ code: string; name: string }[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(
    null,
  );
  const [result, setResult] = useState<FeeResult | null>(null);
  const [locationMode, setLocationMode] = useState<"geocode" | "map">("geocode");
  const [mapPin, setMapPin] = useState({
    lat: CITY_MAP_VIEW.yangon.center[0],
    lng: CITY_MAP_VIEW.yangon.center[1],
  });
  const [routeLine, setRouteLine] = useState<[number, number][] | null>(null);

  useEffect(() => {
    const v = CITY_MAP_VIEW[city];
    setMapPin({ lat: v.center[0], lng: v.center[1] });
    setRouteLine(null);
  }, [city]);

  useEffect(() => {
    let cancelled = false;
    async function loadHubs() {
      try {
        const response = await fetch(`/api/hubs?city=${city}`);
        const payload = await response.json();
        if (cancelled || !response.ok) {
          if (!cancelled) setHubOptions([]);
          return;
        }
        const list = (payload.hubs ?? []) as { code: string; name: string }[];
        setHubOptions(list.map((h) => ({ code: h.code, name: h.name })));
        setManualHub((prev) => {
          if (list.length === 0) return "";
          if (prev && list.some((h) => h.code === prev)) return prev;
          return list[0].code;
        });
      } catch {
        if (!cancelled) setHubOptions([]);
      }
    }
    loadHubs();
    return () => {
      cancelled = true;
    };
  }, [city]);

  async function onSearchAddress(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    setSelectedSuggestion(null);

    try {
      const response = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, city }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to geocode address.");
      }
      setSuggestions(payload.suggestions ?? []);
      if (!payload.requiresSelection && payload.selectedSuggestion) {
        setSelectedSuggestion(payload.selectedSuggestion);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to geocode address.");
    } finally {
      setLoading(false);
    }
  }

  async function onCalculate() {
    if (locationMode === "geocode" && !selectedSuggestion) {
      setError("Select one geocoded suggestion, or switch to “Map pin”.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    setRouteLine(null);
    try {
      const location =
        locationMode === "map"
          ? { lat: mapPin.lat, lng: mapPin.lng }
          : {
              lat: selectedSuggestion!.lat,
              lng: selectedSuggestion!.lng,
            };
      const response = await fetch("/api/calculate-fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city,
          location,
          hubSelectionMode: hubMode,
          manualHubId: hubMode === "manual" ? manualHub : null,
          geocodeProviderUsed:
            locationMode === "map"
              ? "map_pin"
              : selectedSuggestion!.provider,
          inputAddress: address.trim() || null,
          includeRouteGeometry: true,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to calculate transport fee.");
      }
      setResult(payload);
      if (
        payload.routeGeometry?.type === "LineString" &&
        Array.isArray(payload.routeGeometry.coordinates)
      ) {
        const coords = payload.routeGeometry.coordinates as [number, number][];
        setRouteLine(coords.map(([lng, lat]) => [lat, lng]));
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to calculate transport fee.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-2xl bg-brand px-5 py-6 text-white shadow-lg sm:px-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Transport Charge Calculator
            </h1>
            <p className="mt-2 text-sm text-white/90 sm:text-base">
              For home appliance after-sales service operations in Yangon and
              Mandalay.
            </p>
          </div>
          <a
            href="/admin/login"
            className="shrink-0 rounded-lg bg-white/15 px-3 py-2 text-center text-sm font-medium text-white ring-1 ring-white/30 hover:bg-white/25"
          >
            Admin
          </a>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Agent Input
          </h2>
          <form onSubmit={onSearchAddress} className="mt-4 space-y-4">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-slate-700">
                Fee location source
              </legend>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="loc"
                    checked={locationMode === "geocode"}
                    onChange={() => setLocationMode("geocode")}
                    className="text-brand focus:ring-brand"
                  />
                  Geocoded address
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="loc"
                    checked={locationMode === "map"}
                    onChange={() => setLocationMode("map")}
                    className="text-brand focus:ring-brand"
                  />
                  Map pin
                </label>
              </div>
            </fieldset>

            <label className="block text-sm font-medium text-slate-700">
              City
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
                value={city}
                onChange={(event) =>
                  setCity(event.target.value as "yangon" | "mandalay")
                }
              >
                <option value="yangon">Yangon</option>
                <option value="mandalay">Mandalay</option>
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Customer Address
              <input
                required
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Type address, street, landmark or ward"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
              />
            </label>

            <button
              disabled={loading || !address.trim()}
              className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
            >
              {loading ? "Searching..." : "Find Top 3 Suggestions"}
            </button>
          </form>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-900">
              Location Suggestions
            </h3>
            <div className="mt-2 space-y-2">
              {suggestions.length === 0 && (
                <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                  No suggestions yet. Search an address first.
                </p>
              )}
              {suggestions.map((item, index) => {
                const active =
                  selectedSuggestion?.lat === item.lat &&
                  selectedSuggestion?.lng === item.lng;
                return (
                  <div
                    key={`${item.lat}-${item.lng}-${index}`}
                    className={`overflow-hidden rounded-lg border text-sm transition ${
                      active
                        ? "border-brand bg-brand/5"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <button
                      type="button"
                      className="w-full p-3 text-left"
                      onClick={() => setSelectedSuggestion(item)}
                    >
                      <p className="font-medium text-slate-900">{item.displayAddress}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Score: {(item.score * 100).toFixed(0)}% |{" "}
                        {item.lat.toFixed(5)}, {item.lng.toFixed(5)}
                      </p>
                    </button>
                    {active && (
                      <div className="border-t border-slate-100 px-3 py-2">
                        <button
                          type="button"
                          className="text-xs font-semibold text-brand hover:underline"
                          onClick={() => setMapPin({ lat: item.lat, lng: item.lng })}
                        >
                          Move map pin here
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-900">
              Map — tap to place pin, drag to adjust
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Choose “Map pin” above to calculate from the pin. Route line appears
              after you calculate.
            </p>
            <div className="mt-2">
              <CustomerMap
                city={city}
                markerLat={mapPin.lat}
                markerLng={mapPin.lng}
                onMarkerChange={(lat, lng) => setMapPin({ lat, lng })}
                routeLine={routeLine}
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Calculation</h2>
          <div className="mt-4 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Hub Selection
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
                value={hubMode}
                onChange={(event) =>
                  setHubMode(event.target.value as "auto" | "manual")
                }
              >
                <option value="auto">Auto nearest hub</option>
                <option value="manual">Manual override</option>
              </select>
            </label>

            {hubMode === "manual" && (
              <label className="block text-sm font-medium text-slate-700">
                Manual Hub
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
                  value={manualHub}
                  onChange={(event) => setManualHub(event.target.value)}
                  disabled={hubOptions.length === 0}
                >
                  {hubOptions.length === 0 ? (
                    <option value="">Loading hubs…</option>
                  ) : (
                    hubOptions.map((hub) => (
                      <option key={hub.code} value={hub.code}>
                        {hub.name}
                      </option>
                    ))
                  )}
                </select>
              </label>
            )}

            <button
              type="button"
              onClick={onCalculate}
              disabled={
                loading ||
                (locationMode === "geocode" && !selectedSuggestion) ||
                (hubMode === "manual" && !manualHub)
              }
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Calculating..." : "Calculate Transport Fee"}
            </button>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
          </div>

          <div className="mt-6 rounded-xl bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Result</h3>
            {!result && (
              <p className="mt-2 text-sm text-slate-600">
                Calculate to see distance, zone, hub, and final rounded fee.
              </p>
            )}
            {result && (
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <p>
                  <span className="font-semibold">Hub:</span> {result.selectedHub.name}
                </p>
                <p>
                  <span className="font-semibold">Distance:</span>{" "}
                  {result.distanceKm.toFixed(2)} km
                </p>
                <p>
                  <span className="font-semibold">Zone:</span> {result.zone.name}
                </p>
                <p>
                  <span className="font-semibold">Base Fare:</span>{" "}
                  {result.pricing.baseFareMmk.toLocaleString()} MMK
                </p>
                <p>
                  <span className="font-semibold">Per KM:</span>{" "}
                  {result.pricing.perKmRateMmk.toLocaleString()} MMK
                </p>
                <p>
                  <span className="font-semibold">Zone Adj:</span>{" "}
                  {result.pricing.zoneAdjustmentMmk.toLocaleString()} MMK
                </p>
                <p>
                  <span className="font-semibold">Raw:</span>{" "}
                  {result.pricing.rawFeeMmk.toLocaleString()} MMK
                </p>
                <p className="rounded-lg bg-brand px-3 py-2 font-semibold text-white">
                  Final Fee: {result.pricing.finalFeeMmk.toLocaleString()} MMK
                </p>
                {result.logged === false && (
                  <p className="text-xs text-amber-800">
                    <span className="font-semibold">Log not saved.</span>{" "}
                    {result.logError ? (
                      <span className="block mt-1 font-mono">{result.logError}</span>
                    ) : (
                      <span>
                        Add{" "}
                        <code className="rounded bg-amber-100 px-1">
                          SUPABASE_SERVICE_ROLE_KEY
                        </code>{" "}
                        to <code className="rounded bg-amber-100 px-1">.env.local</code>
                        , restart <code className="rounded bg-amber-100 px-1">npm run dev</code>
                        , then check Supabase → Table Editor →{" "}
                        <code className="rounded bg-amber-100 px-1">calculation_logs</code>.
                        If it still fails, run{" "}
                        <code className="rounded bg-amber-100 px-1">
                          supabase/04_insert_calculation_log_rpc.sql
                        </code>{" "}
                        in SQL Editor.
                      </span>
                    )}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
