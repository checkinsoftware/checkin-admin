import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { absoluteUrl } from "@/lib/site-url";
import { USER_COOKIE, verifyUserToken } from "@/lib/user-auth";

export async function POST(req: Request) {
  const store = await cookies();
  const session = await verifyUserToken(store.get(USER_COOKIE)?.value);
  if (session) await logActivity(session.mobile, "logout", null, req);

  const res = NextResponse.redirect(absoluteUrl("/user/login", req), { status: 303 });
  res.cookies.set(USER_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
