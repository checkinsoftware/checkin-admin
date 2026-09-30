import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { absoluteUrl } from "@/lib/site-url";

export async function POST(req: Request) {
  const res = NextResponse.redirect(absoluteUrl("/mng-x7k9/login", req), { status: 303 });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
