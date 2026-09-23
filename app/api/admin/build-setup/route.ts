import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getPool, hasDatabase } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The 5 BuildKhata site-staff logins.
const USERS = [
  { username: "rahul", name: "Rahul" },
  { username: "suresh", name: "Suresh" },
  { username: "amit", name: "Amit" },
  { username: "priya", name: "Priya" },
  { username: "vikas", name: "Vikas" },
];

// One-click setup for BuildKhata: applies db/schema.sql (creates the build_*
// tables, idempotent) and creates/updates the 5 users with the given password.
// Re-running it with a new password resets all 5 passwords. Admin only.
export async function POST(req: Request) {
  const store = await cookies();
  const session = await verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!session || session.tag) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasDatabase()) {
    return NextResponse.json({ error: "DATABASE_URL is not set on this deployment." }, { status: 503 });
  }

  let password = "";
  try {
    const b = await req.json();
    password = String(b.password ?? "");
  } catch {}
  if (password.length < 4) {
    return NextResponse.json({ error: "Password kam se kam 4 character ka hona chahiye." }, { status: 400 });
  }

  const client = await getPool().connect();
  try {
    await client.query(readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8"));
    for (const u of USERS) {
      const hash = await hashPassword(password);
      await client.query(
        `INSERT INTO build_users (username, name, password_hash) VALUES ($1,$2,$3)
         ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name, active = TRUE`,
        [u.username, u.name, hash]
      );
    }
    return NextResponse.json({ ok: true, users: USERS.map((u) => u.username) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Setup failed" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
