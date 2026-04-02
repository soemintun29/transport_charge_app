import { createServerSupabase } from "@/lib/supabase-server";

const GOOGLE_FALLBACK_SETTING_KEY = "google_fallback_enabled";

function envGoogleFallbackEnabled(): boolean {
  return process.env.GOOGLE_FALLBACK_ENABLED === "true";
}

export async function isGoogleFallbackAllowed(): Promise<boolean> {
  const envEnabled = envGoogleFallbackEnabled();
  if (!envEnabled) return false;

  const supabase = createServerSupabase();
  if (!supabase) return envEnabled;

  const { data, error } = await supabase
    .from("admin_runtime_settings")
    .select("bool_value")
    .eq("key", GOOGLE_FALLBACK_SETTING_KEY)
    .maybeSingle();

  if (error || !data) return envEnabled;
  if (typeof data.bool_value === "boolean") return data.bool_value;
  return envEnabled;
}

export async function readGoogleFallbackSetting() {
  const envEnabled = envGoogleFallbackEnabled();
  const supabase = createServerSupabase();
  if (!supabase) {
    return { envEnabled, currentEnabled: envEnabled };
  }

  const { data, error } = await supabase
    .from("admin_runtime_settings")
    .select("bool_value")
    .eq("key", GOOGLE_FALLBACK_SETTING_KEY)
    .maybeSingle();

  if (error || !data || typeof data.bool_value !== "boolean") {
    return { envEnabled, currentEnabled: envEnabled };
  }

  return { envEnabled, currentEnabled: data.bool_value };
}

export async function writeGoogleFallbackSetting(enabled: boolean) {
  const supabase = createServerSupabase();
  if (!supabase) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY missing.");
  }

  const { error } = await supabase.from("admin_runtime_settings").upsert(
    {
      key: GOOGLE_FALLBACK_SETTING_KEY,
      bool_value: enabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (error) throw new Error(error.message);
}
