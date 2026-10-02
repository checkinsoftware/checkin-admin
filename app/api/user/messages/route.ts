import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hasDatabase, query } from "@/lib/db";
import { createUserToken, USER_COOKIE, userCookieMaxAge, verifyUserToken } from "@/lib/user-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A logged-in guest stays logged in until they tap Logout: every successful check
// re-issues the cookie, so a year of inactivity is the only thing that can expire it.
async function withFreshSession(body: object, mobile: string) {
  const res = NextResponse.json(body);
  res.cookies.set(USER_COOKIE, await createUserToken(mobile), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: userCookieMaxAge,
  });
  return res;
}

// Used by the on-site guest widget: is the visitor logged in, their total SMS
// count, and their messages (optionally filtered to one date ?date=YYYY-MM-DD).
export async function GET(req: Request) {
  const store = await cookies();
  const session = await verifyUserToken(store.get(USER_COOKIE)?.value);
  if (!session) return NextResponse.json({ loggedIn: false });

  const dateRaw = new URL(req.url).searchParams.get("date") || "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : "";

  let messages: { id: string; message: string; status: string; created_at: string }[] = [];
  let name = "";
  let total = 0;
  if (hasDatabase()) {
    try {
      // Guests and their dates are India-only, so "today" means the IST
      // calendar day -- comparing straight against $2::date would use the
      // DB's own (UTC) timezone and quietly drop anything sent between
      // midnight and 5:30am IST, which is still UTC "yesterday".
      const where = date
        ? `recipient = $1 AND created_at >= ($2::date::timestamp AT TIME ZONE 'Asia/Kolkata') AND created_at < (($2::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Asia/Kolkata')`
        : `recipient = $1`;
      const params = date ? [session.mobile, date] : [session.mobile];
      messages = await query(
        `SELECT id::text, message, status, created_at FROM sms_messages
         WHERE ${where} ORDER BY created_at DESC LIMIT 300`,
        params
      );
      const t = await query<{ c: number }>(
        `SELECT COUNT(*)::int AS c FROM sms_messages WHERE recipient = $1`,
        [session.mobile]
      );
      total = t[0]?.c ?? 0;
    } catch {
      messages = [];
    }
    let profile = {};
    try {
      const u = await query<{ name: string | null; title: string | null; first_name: string | null; last_name: string | null; email: string | null; dob: string | null; organization: string | null }>(
        `SELECT name, title, first_name, last_name, email, dob, organization FROM app_users WHERE mobile = $1 LIMIT 1`,
        [session.mobile]
      );
      const p = u[0] || {};
      name = p.name ?? "";
      profile = {
        title: p.title ?? "",
        firstName: p.first_name ?? "",
        lastName: p.last_name ?? "",
        email: p.email ?? "",
        dob: p.dob ?? "",
        organization: p.organization ?? "",
      };
    } catch {
      name = "";
    }
    return withFreshSession({ loggedIn: true, mobile: session.mobile, name, profile, total, messages }, session.mobile);
  }

  return withFreshSession({ loggedIn: true, mobile: session.mobile, name, total, messages }, session.mobile);
}
