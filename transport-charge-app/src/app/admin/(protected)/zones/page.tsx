"use client";

import { useCallback, useEffect, useState } from "react";

type Zone = {
  id: string;
  city_id: string;
  city_code: string;
  code: string;
  name: string;
  min_distance_km: number;
  max_distance_km: number;
  is_active: boolean;
  adjustment_mmk: number;
};

export default function AdminZonesPage() {
  const [city, setCity] = useState<"all" | "yangon" | "mandalay">("all");
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Partial<Zone>>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q = city === "all" ? "" : `?city=${city}`;
      const res = await fetch(`/api/admin/zones${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setZones(data.zones ?? []);
      setDrafts({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setZones([]);
    } finally {
      setLoading(false);
    }
  }, [city]);

  useEffect(() => {
    load();
  }, [load]);

  function draft(id: string, patch: Partial<Zone>) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  }

  function getZ(z: Zone): Zone {
    return { ...z, ...drafts[z.id] };
  }

  async function save(z: Zone) {
    const d = getZ(z);
    setSavingId(z.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/zones/${z.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: d.name,
          min_distance_km: d.min_distance_km,
          max_distance_km: d.max_distance_km,
          is_active: d.is_active,
          adjustment_mmk: d.adjustment_mmk,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save error");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Zones & surcharges</h1>
      <p className="mt-1 text-sm text-slate-600">
        Distance bands must not overlap badly; zone adjustment adds to the transport
        formula.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
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
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-8 text-slate-600">Loading…</p>
      ) : (
        <div className="mt-6 space-y-4">
          {zones.map((z) => {
            const d = getZ(z);
            return (
              <div
                key={z.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-slate-900">{d.name}</p>
                  <span className="text-xs text-slate-500">
                    {d.city_code} · {d.code}
                  </span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="block text-sm">
                    <span className="text-slate-600">Min km</span>
                    <input
                      type="number"
                      step="0.01"
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      value={d.min_distance_km}
                      onChange={(e) =>
                        draft(z.id, { min_distance_km: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-600">Max km</span>
                    <input
                      type="number"
                      step="0.01"
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      value={d.max_distance_km}
                      onChange={(e) =>
                        draft(z.id, { max_distance_km: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-600">Zone adj. (MMK)</span>
                    <input
                      type="number"
                      step="1"
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      value={d.adjustment_mmk}
                      onChange={(e) =>
                        draft(z.id, { adjustment_mmk: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="flex items-end gap-2 pb-1 text-sm">
                    <input
                      type="checkbox"
                      checked={d.is_active}
                      onChange={(e) =>
                        draft(z.id, { is_active: e.target.checked })
                      }
                    />
                    Active
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => save(z)}
                  disabled={savingId === z.id}
                  className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {savingId === z.id ? "Saving…" : "Save zone"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
