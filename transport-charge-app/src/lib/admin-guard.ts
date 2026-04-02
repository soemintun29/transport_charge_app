import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSessionValue } from "./admin-session";
import {
  adminSupabaseAuthEnabled,
  createAdminAuthServerClient,
  isAllowlistedAdminEmail,
} from "@/lib/supabase-auth";

export async function getAdminCookieValue(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(ADMIN_COOKIE)?.value;
}

export async function assertAdmin(): Promise<NextResponse | null> {
  if (adminSupabaseAuthEnabled()) {
    try {
      const supabase = await createAdminAuthServerClient();
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (!isAllowlistedAdminEmail(data.user.email)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return null;
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const v = await getAdminCookieValue();
  if (!verifyAdminSessionValue(v)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
