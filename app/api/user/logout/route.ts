import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/site-url";
import { USER_COOKIE } from "@/lib/user-auth";

export async function POST(req: Request) {
  const res = NextResponse.redirect(absoluteUrl("/user/login", req), { status: 303 });
  res.cookies.set(USER_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
