import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { hasDatabase, query } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { normaliseMobile } from "@/lib/sms-insert";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Full admin only (hotel logins can't see or manage web users).
async function requireSession() {
  const store = await cookies();
  const s = await verifySessionToken(store.get(SESSION_COOKIE)?.value);
  return !s || s.tag ? null : s;
}

const s = (v: unknown, n = 60) => String(v ?? "").trim().slice(0, n);

function profileFrom(b: Record<string, unknown>) {
  const first = s(b.firstName);
  const last = s(b.lastName);
  return {
    title: s(b.title, 8) || null,
    first: first || null,
    last: last || null,
    name: [first, last].filter(Boolean).join(" ") || null,
    email: s(b.email, 120) || null,
    dob: s(b.dob, 12) || null,
    // Free text and optional: several owners may belong to the same organization.
    organization: s(b.organization, 100) || null,
  };
}

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

/** Admin creates a guest account (e.g. a hotel owner) with its profile and, optionally, a password. */
export async function POST(req: Request) {
  if (!(await requireSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasDatabase()) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });

  const b = await readBody(req);
  if (!b) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const mobile = normaliseMobile(String(b.mobile ?? ""));
  if (!mobile) return NextResponse.json({ error: "Enter a valid mobile number." }, { status: 400 });

  const password = String(b.password ?? "");
  if (password && password.length < 4) {
    return NextResponse.json({ error: "Password must be at least 4 characters." }, { status: 400 });
  }

  const exists = await query<{ mobile: string }>(`SELECT mobile FROM app_users WHERE mobile = $1`, [mobile]);
  if (exists.length) {
    return NextResponse.json({ error: `${mobile} already has an account. Open it from the list to edit.` }, { status: 409 });
  }

  const p = profileFrom(b);
  const hash = password ? await hashPassword(password) : null;
  await query(
    `INSERT INTO app_users (mobile, name, title, first_name, last_name, email, dob, organization, password_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [mobile, p.name, p.title, p.first, p.last, p.email, p.dob, p.organization, hash]
  );
  await logActivity(mobile, "created", "admin", req);

  return NextResponse.json({ ok: true, mobile, hasPassword: !!hash });
}

/** Admin edits any guest's profile fields; a password is changed only if one is supplied. */
export async function PATCH(req: Request) {
  if (!(await requireSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasDatabase()) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });

  const b = await readBody(req);
  if (!b) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const mobile = String(b.mobile ?? "");
  if (!mobile) return NextResponse.json({ error: "mobile is required" }, { status: 400 });

  const password = String(b.password ?? "");
  if (password && password.length < 4) {
    return NextResponse.json({ error: "Password must be at least 4 characters." }, { status: 400 });
  }

  const p = profileFrom(b);
  const rows = await query<{ mobile: string }>(
    `UPDATE app_users SET name = $2, title = $3, first_name = $4, last_name = $5,
            email = $6, dob = $7, organization = $8
     WHERE mobile = $1 RETURNING mobile`,
    [mobile, p.name, p.title, p.first, p.last, p.email, p.dob, p.organization]
  );
  if (rows.length === 0) return NextResponse.json({ error: "User not found." }, { status: 404 });

  if (password) {
    await query(`UPDATE app_users SET password_hash = $2 WHERE mobile = $1`, [mobile, await hashPassword(password)]);
  }
  return NextResponse.json({ ok: true, passwordChanged: !!password });
}

/** Admin removes a guest account (e.g. one created with a wrong number). Their SMS history stays. */
export async function DELETE(req: Request) {
  if (!(await requireSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasDatabase()) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });

  const b = await readBody(req);
  const mobile = String(b?.mobile ?? "");
  if (!mobile) return NextResponse.json({ error: "mobile is required" }, { status: 400 });

  await query(`DELETE FROM device_tokens WHERE mobile = $1`, [mobile]);
  await query(`DELETE FROM user_activity WHERE mobile = $1`, [mobile]).catch(() => {});
  await query(`DELETE FROM app_users WHERE mobile = $1`, [mobile]);
  return NextResponse.json({ ok: true });
}
