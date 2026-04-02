import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  await request.text();
  return NextResponse.json(
    { error: "Use Supabase Auth via /admin/login form." },
    { status: 410 },
  );
}
