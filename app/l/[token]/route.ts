import { NextResponse } from "next/server";
import { hasDatabase, query } from "@/lib/db";
import { absoluteUrl } from "@/lib/site-url";
import { createUserToken, USER_COOKIE, userCookieMaxAge } from "@/lib/user-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Magic login link. Opening /l/<token> logs the guest in (if the token is
 * valid and unexpired) and lands them on the on-site SMS page. Invalid or
 * expired links fall through to /sms, where the normal OTP login prompt opens.
 * Kept only for already-sent long links — the DLT-registered CTA is the bare
 * query form /l?<token>, handled by ../route.ts.
 */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const homeUrl = absoluteUrl("/sms?expired=1", req);

  if (!token || !hasDatabase()) return NextResponse.redirect(homeUrl);

  let mobile = "", hotel = "";
  try {
    const rows = await query<{ mobile: string; name: string | null }>(
      `SELECT mobile, name FROM magic_links
       WHERE token = $1 AND expires_at > NOW()
       LIMIT 1`,
      [token]
    );
    if (rows.length === 0) return NextResponse.redirect(homeUrl);
    mobile = rows[0].mobile;
    hotel = rows[0].name ?? "";
  } catch {
    return NextResponse.redirect(homeUrl);
  }

  // Record first use (audit) and keep the guest's profile row fresh.
  try {
    await query(`UPDATE magic_links SET used_at = COALESCE(used_at, NOW()) WHERE token = $1`, [token]);
    await query(
      `INSERT INTO app_users (mobile, last_login_at) VALUES ($1, NOW())
       ON CONFLICT (mobile) DO UPDATE SET last_login_at = NOW()`,
      [mobile]
    );
  } catch {
    /* login must not fail on an audit write */
  }

  const dest = absoluteUrl("/welcome", req);
  if (hotel) dest.searchParams.set("h", hotel);
  const res = NextResponse.redirect(dest);
  res.cookies.set(USER_COOKIE, await createUserToken(mobile), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: userCookieMaxAge,
  });
  return res;
}
