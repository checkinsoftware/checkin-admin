import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hasDatabase, query } from "@/lib/db";
import { USER_COOKIE, verifyUserToken } from "@/lib/user-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Registers (or refreshes) this browser's FCM token for the logged-in number. */
export async function POST(req: Request) {
  const store = await cookies();
  const session = await verifyUserToken(store.get(USER_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  }

  let token = "";
  let installed = false;
  try {
    const body = await req.json();
    token = String(body?.token ?? "").trim();
    installed = body?.installed === true;
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }
  if (token.length < 20) return NextResponse.json({ error: "Invalid token." }, { status: 400 });

  const ua = req.headers.get("user-agent")?.slice(0, 300) ?? null;
  try {
    // Once a token has been seen from the installed app it stays marked, even if a
    // browser tab on the same device refreshes it later.
    await query(
      `INSERT INTO device_tokens (mobile, token, user_agent, installed)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (token) DO UPDATE
         SET mobile = EXCLUDED.mobile, last_seen_at = NOW(), user_agent = EXCLUDED.user_agent,
             installed = device_tokens.installed OR EXCLUDED.installed`,
      [session.mobile, token, ua, installed]
    );
  } catch (err) {
    // Column not migrated yet (db-setup hasn't run): register the token without it.
    if ((err as { code?: string }).code !== "42703") throw err;
    await query(
      `INSERT INTO device_tokens (mobile, token, user_agent)
       VALUES ($1, $2, $3)
       ON CONFLICT (token) DO UPDATE
         SET mobile = EXCLUDED.mobile, last_seen_at = NOW(), user_agent = EXCLUDED.user_agent`,
      [session.mobile, token, ua]
    );
  }

  const count = await query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM device_tokens WHERE mobile = $1`,
    [session.mobile]
  );
  return NextResponse.json({ ok: true, mobile: session.mobile, devices: count[0].c });
}

/** Removes this browser's token — used when the user turns notifications off. */
export async function DELETE(req: Request) {
  const store = await cookies();
  const session = await verifyUserToken(store.get(USER_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  let token = "";
  try {
    token = String((await req.json())?.token ?? "").trim();
  } catch {
    /* delete-all fallback below */
  }

  if (token) await query(`DELETE FROM device_tokens WHERE token = $1 AND mobile = $2`, [token, session.mobile]);
  else await query(`DELETE FROM device_tokens WHERE mobile = $1`, [session.mobile]);

  return NextResponse.json({ ok: true });
}
