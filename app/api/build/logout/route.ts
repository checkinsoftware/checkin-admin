import { NextResponse } from "next/server";
import { BUILD_COOKIE } from "@/lib/build-auth";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(BUILD_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
