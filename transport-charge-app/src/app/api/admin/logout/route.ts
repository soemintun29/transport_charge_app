import { NextResponse } from "next/server";
import { createAdminAuthServerClient } from "@/lib/supabase-auth";

export async function POST() {
  const supabase = await createAdminAuthServerClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
