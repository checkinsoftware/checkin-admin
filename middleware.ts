import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { USER_COOKIE, verifyUserToken } from "@/lib/user-auth";
import { BUILD_COOKIE, verifyBuildToken } from "@/lib/build-auth";

// Admin panel lives under a secret base path (not /admin). /admin and /login
// no longer exist as routes, so they 404 for anyone who guesses them.
const ADMIN_BASE = "/mng-x7k9";
const ADMIN_LOGIN = "/mng-x7k9/login";

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // BuildKhata app: protect /build except its own login page and static
  // assets (manifest, icon — any path with a file extension under /build).
  if (pathname === "/build" || pathname.startsWith("/build/")) {
    const lastSeg = pathname.startsWith("/build/") ? pathname.slice("/build/".length) : "";
    const isAsset = lastSeg.includes(".");
    if (pathname !== "/build/login" && !isAsset) {
      const build = await verifyBuildToken(req.cookies.get(BUILD_COOKIE)?.value);
      if (!build) {
        const url = req.nextUrl.clone();
        url.pathname = "/build/login";
        url.search = "";
        return NextResponse.redirect(url);
      }
    }
    return NextResponse.next();
  }

  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);

  // Protect the whole admin area except its own login page.
  const inAdmin = pathname === ADMIN_BASE || pathname.startsWith(ADMIN_BASE + "/");
  if (inAdmin && pathname !== ADMIN_LOGIN && !session) {
    const url = req.nextUrl.clone();
    url.pathname = ADMIN_LOGIN;
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  // Already signed in and hitting the login page -> go to dashboard.
  if (pathname === ADMIN_LOGIN && session) {
    const url = req.nextUrl.clone();
    url.pathname = ADMIN_BASE;
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Guest area. /user renders its own bottom-sheet login when logged out, so we
  // no longer force a redirect there — only bounce an already-logged-in guest
  // off the standalone /user/login page.
  if (pathname === "/user/login") {
    const user = await verifyUserToken(req.cookies.get(USER_COOKIE)?.value);
    if (user) {
      const url = req.nextUrl.clone();
      url.pathname = "/user";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/mng-x7k9", "/mng-x7k9/:path*", "/user", "/user/:path*", "/build", "/build/:path*"],
};
