import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { hasDatabase, query } from "@/lib/db";
import { normaliseMobile } from "@/lib/sms-insert";
import { createUserToken, USER_COOKIE, userCookieMaxAge } from "@/lib/user-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const skipVerification = () => process.env.OTP_SKIP !== "false";

export async function POST(req: Request) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  }

  let mobileRaw = "";
  let code = "";
  try {
    const body = await req.json();
    mobileRaw = String(body?.mobile ?? "");
    code = String(body?.code ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const mobile = normaliseMobile(mobileRaw);
  if (!mobile) return NextResponse.json({ error: "Invalid mobile number." }, { status: 400 });

  if (!skipVerification()) {
    const rows = await query<{ id: string }>(
      `SELECT id::text FROM otp_codes
       WHERE mobile = $1 AND code = $2 AND used_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [mobile, code]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "That code is wrong or has expired." }, { status: 401 });
    }
    await query(`UPDATE otp_codes SET used_at = NOW() WHERE id = $1`, [rows[0].id]);
  }

  await query(
    `INSERT INTO app_users (mobile, last_login_at) VALUES ($1, NOW())
     ON CONFLICT (mobile) DO UPDATE SET last_login_at = NOW()`,
    [mobile]
  );

  await logActivity(mobile, "login", "otp", req);

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
