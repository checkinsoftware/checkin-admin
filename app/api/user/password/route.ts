import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hasDatabase, query } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { USER_COOKIE, verifyUserToken } from "@/lib/user-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lets a logged-in guest set or change their own password, for when OTP delivery isn't available. */
export async function POST(req: Request) {
  const store = await cookies();
  const session = await verifyUserToken(store.get(USER_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  if (!hasDatabase()) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });

  let password = "";
  try {
    password = String((await req.json())?.password ?? "");
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }
  if (password.length < 4) {
    return NextResponse.json({ error: "Password must be at least 4 characters." }, { status: 400 });
  }

  const hash = await hashPassword(password);
  await query(`UPDATE app_users SET password_hash = $1 WHERE mobile = $2`, [hash, session.mobile]);

  return NextResponse.json({ ok: true });
}

/** Lets a logged-in guest remove their password (OTP-only login again). */
export async function DELETE() {
  const store = await cookies();
  const session = await verifyUserToken(store.get(USER_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  if (!hasDatabase()) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });

  await query(`UPDATE app_users SET password_hash = NULL WHERE mobile = $1`, [session.mobile]);
  return NextResponse.json({ ok: true });
}
