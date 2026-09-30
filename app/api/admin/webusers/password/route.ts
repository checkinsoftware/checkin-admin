import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { hasDatabase, query } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Full admin only (hotel logins can't see/manage web users at all).
async function requireSession() {
  const store = await cookies();
  const s = await verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!s || s.tag) return null;
  return s;
}

/** Admin sets (or resets) a guest's password. The admin never sees the old one. */
export async function POST(req: Request) {
  if (!(await requireSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasDatabase()) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });

  let mobile = "";
  let password = "";
  try {
    const body = await req.json();
    mobile = String(body?.mobile ?? "");
    password = String(body?.password ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!mobile) return NextResponse.json({ error: "mobile is required" }, { status: 400 });
  if (password.length < 4) {
    return NextResponse.json({ error: "Password must be at least 4 characters." }, { status: 400 });
  }

  const hash = await hashPassword(password);
  const rows = await query<{ mobile: string }>(
    `UPDATE app_users SET password_hash = $1 WHERE mobile = $2 RETURNING mobile`,
    [hash, mobile]
  );
  if (rows.length === 0) return NextResponse.json({ error: "User not found." }, { status: 404 });

  return NextResponse.json({ ok: true });
}

/** Admin clears a guest's password (back to OTP-only). */
export async function DELETE(req: Request) {
  if (!(await requireSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasDatabase()) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });

  let mobile = "";
  try {
    mobile = String((await req.json())?.mobile ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!mobile) return NextResponse.json({ error: "mobile is required" }, { status: 400 });

  await query(`UPDATE app_users SET password_hash = NULL WHERE mobile = $1`, [mobile]);
  return NextResponse.json({ ok: true });
}
