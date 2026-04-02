"use client";

import { useEffect, useState } from "react";

type SettingResponse = {
  envEnabled: boolean;
  currentEnabled: boolean;
  usage?: {
    yearMonth: string;
    callCount: number | null;
  };
};

export function GoogleFallbackToggleCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<SettingResponse | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/google-fallback", {
          credentials: "same-origin",
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Failed to load setting.");
        if (active) setState(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Request failed.";
        if (active) setError(message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function onToggle(next: boolean) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/google-fallback", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to save setting.");
      setState(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">
        Google fallback usage
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Turn Google Geocoding/Distance fallback on or off without redeploy.
      </p>

      {loading ? (
        <p className="mt-3 text-sm text-slate-500">Loading setting...</p>
      ) : state ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onToggle(!state.currentEnabled)}
            disabled={saving || !state.envEnabled}
            className="rounded-lg bg-[#0098D1] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : state.currentEnabled
                ? "Disable Google usage"
                : "Enable Google usage"}
          </button>
          <span
            className={`rounded-full px-2 py-1 text-xs font-semibold ${
              state.currentEnabled
                ? "bg-green-100 text-green-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {state.currentEnabled ? "Currently ON" : "Currently OFF"}
          </span>
          {!state.envEnabled ? (
            <span className="text-xs text-slate-500">
              Env `GOOGLE_FALLBACK_ENABLED` is false, so runtime toggle is locked.
            </span>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {state?.usage ? (
        <p className="mt-3 text-xs text-slate-500">
          Usage this month ({state.usage.yearMonth}):{" "}
          {state.usage.callCount == null ? "unknown" : state.usage.callCount}{" "}
          calls
        </p>
      ) : null}
    </section>
  );
}
