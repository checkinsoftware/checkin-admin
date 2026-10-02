import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { DbNotReady, guestInfo, listSms, parseFilters } from "@/lib/sms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One page of the SMS list (plus each number's account/push status), for the
// admin list's scroll-to-load-more.
export async function GET(req: Request) {
  const store = await cookies();
  const session = await verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = Object.fromEntries(new URL(req.url).searchParams.entries());
  const filters = parseFilters(sp);
  if (session.tag) filters.tag = session.tag; // hotel login stays locked to its own SMS

  try {
    const { rows, pages } = await listSms(filters);
    const guests = await guestInfo(rows.map((r) => r.recipient));
    return NextResponse.json({ rows, guests, pages, page: filters.page });
  } catch (err) {
    if (err instanceof DbNotReady) return NextResponse.json({ error: err.message }, { status: 503 });
    throw err;
  }
}
