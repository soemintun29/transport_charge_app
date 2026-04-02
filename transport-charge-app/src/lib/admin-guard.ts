import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSessionValue } from "./admin-session";

export async function getAdminCookieValue(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(ADMIN_COOKIE)?.value;
}

export async function assertAdmin(): Promise<NextResponse | null> {
  const v = await getAdminCookieValue();
  if (!verifyAdminSessionValue(v)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
