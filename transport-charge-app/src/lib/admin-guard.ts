import { NextResponse } from "next/server";
import {
  createAdminAuthServerClient,
  isAllowlistedAdminEmail,
} from "@/lib/supabase-auth";

export async function assertAdmin(): Promise<NextResponse | null> {
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
