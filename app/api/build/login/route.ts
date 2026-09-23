import { NextResponse } from "next/server";
import { createBuildToken, BUILD_COOKIE, buildCookieMaxAge } from "@/lib/build-auth";
import { verifyBuildUser } from "@/lib/build";
import { hasDatabase } from "@/lib/db";

export const runtime = "nodejs";

const attempts = new Map<string, { count: number; until: number }>();
const WINDOW_MS = 5 * 60_000;
const MAX_ATTEMPTS = 10;

function throttled(ip: string) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.until < now) {
    attempts.set(ip, { count: 1, until: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (throttled(ip)) {
    return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 500 });
  }

  let username = "";
  let password = "";
  try {
    const body = await req.json();
    username = String(body.username ?? "");
    password = String(body.password ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  let user: { username: string; name: string } | null = null;
  try {
    user = await verifyBuildUser(username, password);
  } catch {
    return NextResponse.json({ error: "Login not available. Run the DB setup first." }, { status: 500 });
  }
  if (!user) {
    return NextResponse.json({ error: "Wrong username or password." }, { status: 401 });
  }

  attempts.delete(ip);
  const token = await createBuildToken(user.username, user.name);
  const res = NextResponse.json({ ok: true, name: user.name });
  res.cookies.set(BUILD_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: buildCookieMaxAge,
  });
  return res;
}
