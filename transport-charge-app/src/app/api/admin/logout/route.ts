import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/admin-session";
import {
  adminSupabaseAuthEnabled,
  createAdminAuthServerClient,
} from "@/lib/supabase-auth";

export async function POST() {
  if (adminSupabaseAuthEnabled()) {
    const supabase = await createAdminAuthServerClient();
    await supabase.auth.signOut();
  }
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  return NextResponse.json({ ok: true });
}
