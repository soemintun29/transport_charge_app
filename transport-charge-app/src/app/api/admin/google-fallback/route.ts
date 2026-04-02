import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-guard";
import { createServerSupabase } from "@/lib/supabase-server";
import {
  readGoogleFallbackSetting,
  writeGoogleFallbackSetting,
} from "@/lib/google-fallback-policy";

function currentYearMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

async function readCurrentMonthGoogleUsageCount(): Promise<number | null> {
  const supabase = createServerSupabase();
  if (!supabase) return null;

  const ym = currentYearMonth();
  const { data, error } = await supabase
    .from("google_api_monthly_usage")
    .select("call_count")
    .eq("year_month", ym)
    .maybeSingle();

  if (error || !data) return null;
  const n = Number(data.call_count);
  return Number.isFinite(n) ? n : null;
}

export async function GET() {
  const denied = await assertAdmin();
  if (denied) return denied;

  const setting = await readGoogleFallbackSetting();
  const usageCount = await readCurrentMonthGoogleUsageCount();
  return NextResponse.json({
    ...setting,
    usage: {
      yearMonth: currentYearMonth(),
      callCount: usageCount,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const denied = await assertAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    if (typeof body.enabled !== "boolean") {
      return NextResponse.json(
        { error: "enabled (boolean) is required." },
        { status: 400 },
      );
    }

    await writeGoogleFallbackSetting(body.enabled);
    const setting = await readGoogleFallbackSetting();
    const usageCount = await readCurrentMonthGoogleUsageCount();
    return NextResponse.json({
      ...setting,
      usage: {
        yearMonth: currentYearMonth(),
        callCount: usageCount,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
