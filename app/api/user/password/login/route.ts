import { NextResponse } from "next/server";
import { hasDatabase, query } from "@/lib/db";
import { normaliseMobile } from "@/lib/sms-insert";
import { verifyPassword } from "@/lib/password";
import { createUserToken, USER_COOKIE, userCookieMaxAge } from "@/lib/user-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Guest login via mobile + password — the fallback when OTP delivery isn't available. */
export async function POST(req: Request) {
  if (!hasDatabase()) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });

  let mobileRaw = "";
  let password = "";
  try {
    const body = await req.json();
    mobileRaw = String(body?.mobile ?? "");
    password = String(body?.password ?? "");
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const mobile = normaliseMobile(mobileRaw);
  if (!mobile) return NextResponse.json({ error: "Invalid mobile number." }, { status: 400 });
  if (!password) return NextResponse.json({ error: "Password is required." }, { status: 400 });

  const rows = await query<{ password_hash: string | null }>(
    `SELECT password_hash FROM app_users WHERE mobile = $1 LIMIT 1`,
    [mobile]
  );
  const hash = rows[0]?.password_hash;
  if (!hash || !(await verifyPassword(password, hash))) {
    return NextResponse.json({ error: "Wrong mobile number or password." }, { status: 401 });
  }

  await query(`UPDATE app_users SET last_login_at = NOW() WHERE mobile = $1`, [mobile]);

  const res = NextResponse.json({ ok: true, mobile });
  res.cookies.set(USER_COOKIE, await createUserToken(mobile), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: userCookieMaxAge,
  });
  return res;
}
