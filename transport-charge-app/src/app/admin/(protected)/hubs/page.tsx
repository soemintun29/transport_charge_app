"use client";

import { useCallback, useEffect, useState } from "react";

type Hub = {
  id: string;
  code: string;
  name: string;
  address_text: string | null;
  lat: number;
  lng: number;
  is_active: boolean;
};

export default function AdminHubsPage() {
  const [city, setCity] = useState<"all" | "yangon" | "mandalay">("all");
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Partial<Hub>>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q = city === "all" ? "" : `?city=${city}`;
      const res = await fetch(`/api/admin/hubs${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setHubs(data.hubs ?? []);
      setDrafts({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setHubs([]);
    } finally {
      setLoading(false);
    }
  }, [city]);

  useEffect(() => {
    load();
  }, [load]);

  function draft(id: string, patch: Partial<Hub>) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  }

  function getHub(h: Hub): Hub {
    return { ...h, ...drafts[h.id] };
  }

  async function save(h: Hub) {
    const d = getHub(h);
    setSavingId(h.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/hubs/${h.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: d.name,
          address_text: d.address_text ?? "",
          lat: d.lat,
          lng: d.lng,
          is_active: d.is_active,
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
      <h1 className="text-2xl font-bold text-slate-900">Service hubs</h1>
      <p className="mt-1 text-sm text-slate-600">
        Lat/lng updates hub location for routing and the map view.
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
        <div className="mt-6 space-y-6">
          {hubs.map((h) => {
            const d = getHub(h);
            return (
              <div
                key={h.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="text-xs font-mono text-slate-500">{d.code}</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="text-slate-600">Name</span>
                    <input
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      value={d.name}
                      onChange={(e) => draft(h.id, { name: e.target.value })}
                    />
                  </label>
                  <label className="block text-sm sm:col-span-2">
                    <span className="text-slate-600">Address</span>
                    <input
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      value={d.address_text ?? ""}
                      onChange={(e) =>
                        draft(h.id, { address_text: e.target.value })
                      }
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-600">Latitude</span>
                    <input
                      type="number"
                      step="any"
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      value={d.lat}
                      onChange={(e) =>
                        draft(h.id, { lat: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-600">Longitude</span>
                    <input
                      type="number"
                      step="any"
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      value={d.lng}
                      onChange={(e) =>
                        draft(h.id, { lng: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={d.is_active}
                      onChange={(e) =>
                        draft(h.id, { is_active: e.target.checked })
                      }
                    />
                    Active
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => save(h)}
                  disabled={savingId === h.id}
                  className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {savingId === h.id ? "Saving…" : "Save hub"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
