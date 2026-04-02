import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, createAdminSessionValue } from "@/lib/admin-session";
import { adminSupabaseAuthEnabled } from "@/lib/supabase-auth";

export async function POST(request: NextRequest) {
  if (adminSupabaseAuthEnabled()) {
    return NextResponse.json(
      { error: "Password login disabled (Supabase Auth enabled)." },
      { status: 400 },
    );
  }
  try {
    const body = await request.json();
    const password = typeof body.password === "string" ? body.password : "";
    const expected = process.env.ADMIN_PASSWORD ?? "";
    if (!expected) {
      return NextResponse.json(
        { error: "ADMIN_PASSWORD is not configured on the server." },
        { status: 503 },
      );
    }
    if (password !== expected) {
      return NextResponse.json({ error: "Invalid password." }, { status: 401 });
    }
    const token = createAdminSessionValue();
    const jar = await cookies();
    jar.set(ADMIN_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
