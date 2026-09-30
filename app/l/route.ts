import { NextResponse } from "next/server";
import { hasDatabase, query } from "@/lib/db";
import { absoluteUrl } from "@/lib/site-url";
import { createUserToken, USER_COOKIE, userCookieMaxAge } from "@/lib/user-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Magic login link, query form: /l?<token>  — this is the exact prefix
 * registered as the DLT "Dynamic URL" CTA, so it must stay a bare query with
 * no "t=" key. Also still accepts /l?t=<token> for links already sent that
 * way. checkin.exe may tack "&otp=NNNN" onto the end for display only.
 *
 * The bare-token case needs its own parsing: a plain URLSearchParams read
 * would misfire on "?<token>&otp=2948" because the presence of "otp=" makes
 * the whole query string look "keyed", even though the token itself has no
 * "=". So: the token is whichever entry parses with an empty value (that's
 * what a key-less "?<token>" becomes), falling back to "t"/"k" otherwise.
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  let token = "";
  for (const [k, v] of u.searchParams.entries()) {
    if (v === "") { token = k; break; } // /l?<token>[&otp=...]
  }
  if (!token) token = u.searchParams.get("t") || u.searchParams.get("k") || "";
  token = decodeURIComponent(token.trim());
  const otp = u.searchParams.get("otp") || "";

  const bad = absoluteUrl("/sms?expired=1", req);
  if (!token || !hasDatabase()) return NextResponse.redirect(bad);

  let mobile = "", hotel = "", already = false;
  try {
    const rows = await query<{ mobile: string; name: string | null; used_at: string | null }>(
      `SELECT mobile, name, used_at FROM magic_links WHERE token = $1 AND expires_at > NOW() LIMIT 1`,
      [token]
    );
    if (rows.length === 0) return NextResponse.redirect(bad);
    mobile = rows[0].mobile;
    hotel = rows[0].name ?? "";
    already = rows[0].used_at !== null; // this exact link was opened before
  } catch {
    return NextResponse.redirect(bad);
  }

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

  // Land on the welcome page (thank-you + notification opt-in), hotel name
  // (and the vendor's display-only OTP, if it appended one) in tow.
  const dest = absoluteUrl("/welcome", req);
  if (hotel) dest.searchParams.set("h", hotel);
  if (otp) dest.searchParams.set("otp", otp);
  if (already) dest.searchParams.set("already", "1");
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
