import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE, sessionMaxAge } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { hasDatabase } from "@/lib/db";
import { tooMany } from "@/lib/rate-limit";
import { adminUserExists, verifyAdminUser } from "@/lib/admin-users";

export const runtime = "nodejs";

// Small in-memory throttle. Good enough for a single-admin panel.
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
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429 }
    );
  }

  // The in-memory throttle above is per serverless instance; this one is shared.
  if (hasDatabase() && (await tooMany(`admin-login:ip:${ip}`, 10, 900))) {
    return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
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

  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedHash = process.env.ADMIN_PASSWORD_HASH;
  const missing = (["ADMIN_USERNAME", "ADMIN_PASSWORD_HASH", "SESSION_SECRET"] as const).filter(
    (name) => !process.env[name]
  );
  if (missing.length || !expectedUser || !expectedHash) {
    // Names only — never the values.
    return NextResponse.json(
      { error: `Admin login is not configured. Missing env vars: ${missing.join(", ")}` },
      { status: 500 }
    );
  }

  let sessionUser: string | null = null;
  let sessionTag: string | null = null;

  // 1) Admin users stored in the DB (includes the recovery admin once its
  //    password has been changed / "promoted" into the DB). A user with an
  //    sms_tag is a limited "hotel" login.
  if (hasDatabase()) {
    try {
      const u = await verifyAdminUser(username, password);
      if (u) {
        sessionUser = u.username;
        sessionTag = u.tag;
      }
    } catch {
      // DB down / table missing -> fall through to the env check.
    }
  }

  // 2) Bootstrap / recovery admin from env vars — accepted ONLY while that
  //    username has no DB row yet (so the old env password is revoked once the
  //    admin changes it in the panel). If the DB is down, still allow it.
  if (
    !sessionUser &&
    username.toLowerCase() === expectedUser.toLowerCase() &&
    (await verifyPassword(password, expectedHash))
  ) {
    let hasDbRow = false;
    if (hasDatabase()) {
      try {
        hasDbRow = await adminUserExists(expectedUser);
      } catch {
        hasDbRow = false; // DB unreachable -> allow env recovery
      }
    }
    if (!hasDbRow) sessionUser = expectedUser;
  }

  if (!sessionUser) {
    return NextResponse.json({ error: "Wrong username or password." }, { status: 401 });
  }

  attempts.delete(ip);
  const token = await createSessionToken(sessionUser, sessionTag ?? undefined);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionMaxAge,
  });
  return res;
}
