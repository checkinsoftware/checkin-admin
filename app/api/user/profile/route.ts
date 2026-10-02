import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hasDatabase, query } from "@/lib/db";
import { USER_COOKIE, verifyUserToken } from "@/lib/user-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const s = (v: unknown, n = 60) => String(v ?? "").trim().slice(0, n);

// Guest updates their own profile.
export async function POST(req: Request) {
  const store = await cookies();
  const session = await verifyUserToken(store.get(USER_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Login karein." }, { status: 401 });
  if (!hasDatabase())
    return NextResponse.json({ error: "Database is not configured." }, { status: 503 });

  let b: Record<string, unknown> = {};
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const title = s(b.title, 8);
  const first = s(b.firstName);
  const last = s(b.lastName);
  const email = s(b.email, 120);
  const dob = s(b.dob, 12);
  const organization = s(b.organization, 100); // free text, optional, may repeat across guests
  // Prefer an explicit "name", else build it from first + last.
  const name = s(b.name) || [first, last].filter(Boolean).join(" ");

  try {
    await query(
      `INSERT INTO app_users (mobile, name, title, first_name, last_name, email, dob, organization, last_login_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
       ON CONFLICT (mobile) DO UPDATE SET
         name = EXCLUDED.name, title = EXCLUDED.title, first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name, email = EXCLUDED.email, dob = EXCLUDED.dob,
         organization = EXCLUDED.organization`,
      [session.mobile, name || null, title || null, first || null, last || null, email || null, dob || null, organization || null]
    );
    return NextResponse.json({ ok: true, name });
  } catch {
    return NextResponse.json({ error: "Could not save. Run DB setup." }, { status: 503 });
  }
}
