// app/api/auth/logout/route.ts
import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true }, { status: 200 });

  // Cookie löschen
  res.cookies.set("admin_auth", "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });

  return res;
}
