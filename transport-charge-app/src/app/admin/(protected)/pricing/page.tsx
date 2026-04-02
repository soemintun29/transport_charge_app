"use client";

import { useCallback, useEffect, useState } from "react";

type Rule = {
  id: string;
  city_id: string;
  base_fare_mmk: number;
  per_km_rate_mmk: number;
  rounding_strategy: string;
  city: { code: string; name: string } | null;
};

export default function AdminPricingPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Partial<Rule>>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/pricing");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setRules(data.rules ?? []);
      setDrafts({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function draft(id: string, patch: Partial<Rule>) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  }

  function getR(r: Rule): Rule {
    return { ...r, ...drafts[r.id] };
  }

  async function save(r: Rule) {
    const d = getR(r);
    setSavingId(r.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/pricing/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base_fare_mmk: d.base_fare_mmk,
          per_km_rate_mmk: d.per_km_rate_mmk,
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
      <h1 className="text-2xl font-bold text-slate-900">City pricing</h1>
      <p className="mt-1 text-sm text-slate-600">
        One active rule per city. Final fee still rounds to nearest 1,000 MMK in the
        calculator.
      </p>

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-8 text-slate-600">Loading…</p>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {rules.map((r) => {
            const d = getR(r);
            const label = d.city?.name ?? d.city?.code ?? r.city_id;
            return (
              <div
                key={r.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <h2 className="font-semibold text-slate-900">{label}</h2>
                <p className="text-xs text-slate-500">{d.rounding_strategy}</p>
                <div className="mt-4 space-y-3">
                  <label className="block text-sm">
                    <span className="text-slate-600">Base fare (MMK)</span>
                    <input
                      type="number"
                      step="1"
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      value={d.base_fare_mmk}
                      onChange={(e) =>
                        draft(r.id, { base_fare_mmk: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-600">Per km (MMK)</span>
                    <input
                      type="number"
                      step="1"
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      value={d.per_km_rate_mmk}
                      onChange={(e) =>
                        draft(r.id, { per_km_rate_mmk: Number(e.target.value) })
                      }
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => save(r)}
                  disabled={savingId === r.id}
                  className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {savingId === r.id ? "Saving…" : "Save pricing"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
