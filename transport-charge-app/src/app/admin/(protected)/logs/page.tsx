"use client";

import { useCallback, useEffect, useState } from "react";

type LogRow = {
  id: string;
  request_time: string;
  input_address: string | null;
  distance_km: number;
  hub_selection_mode: string;
  base_fare_mmk: number;
  per_km_rate_mmk: number;
  zone_adjustment_mmk: number;
  raw_fee_mmk: number;
  final_fee_mmk: number;
  status: string;
  geocode_provider_used: string;
  route_provider_used: string;
  city_code: string;
  hub_label: string;
  zone_label: string;
};

export default function AdminLogsPage() {
  const [city, setCity] = useState<"all" | "yangon" | "mandalay">("all");
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const limit = 30;

  const load = useCallback(
    async (nextOffset: number, append: boolean) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          limit: String(limit),
          offset: String(nextOffset),
        });
        if (city !== "all") params.set("city", city);
        const res = await fetch(`/api/admin/logs?${params}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load");
        const rows = data.logs ?? [];
        setTotal(data.total ?? 0);
        setLogs((prev) => (append ? [...prev, ...rows] : rows));
        setOffset(nextOffset + rows.length);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
        if (!append) setLogs([]);
      } finally {
        setLoading(false);
      }
    },
    [city],
  );

  useEffect(() => {
    setOffset(0);
    load(0, false);
  }, [city, load]);

  const hasMore = offset < total;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Calculation logs</h1>
      <p className="mt-1 text-sm text-slate-600">
        Recent calculations ({total} total matching filter).
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(["all", "yangon", "mandalay"] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCity(c)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              city === c
                ? "bg-[#0098D1] text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-200"
            }`}
          >
            {c === "all" ? "All cities" : c === "yangon" ? "Yangon" : "Mandalay"}
          </button>
        ))}
        <a
          href={
            city === "all"
              ? "/api/admin/logs/export"
              : `/api/admin/logs/export?city=${city}`
          }
          className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          Download CSV (up to 5k rows)
        </a>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[900px] w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">City</th>
              <th className="px-3 py-2">Address</th>
              <th className="px-3 py-2">Hub</th>
              <th className="px-3 py-2">Zone</th>
              <th className="px-3 py-2">Km</th>
              <th className="px-3 py-2">Final MMK</th>
              <th className="px-3 py-2">Geo</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((row) => (
              <tr key={row.id} className="border-b border-slate-100">
                <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">
                  {new Date(row.request_time).toLocaleString()}
                </td>
                <td className="px-3 py-2">{row.city_code}</td>
                <td className="max-w-[200px] truncate px-3 py-2" title={row.input_address ?? ""}>
                  {row.input_address ?? "—"}
                </td>
                <td className="max-w-[160px] truncate px-3 py-2 text-xs">
                  {row.hub_label}
                </td>
                <td className="px-3 py-2 text-xs">{row.zone_label}</td>
                <td className="px-3 py-2">{Number(row.distance_km).toFixed(2)}</td>
                <td className="px-3 py-2 font-medium">
                  {Number(row.final_fee_mmk).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">
                  {row.geocode_provider_used}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && !loading && (
          <p className="p-6 text-center text-slate-600">No rows yet.</p>
        )}
      </div>

      {hasMore && (
        <button
          type="button"
          disabled={loading}
          onClick={() => load(offset, true)}
          className="mt-4 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
