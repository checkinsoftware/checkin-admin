import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { hasDatabase } from "@/lib/db";
import {
  deleteAdminUser,
  setAdminUserPassword,
  setAdminUserTag,
  tagError,
  validPassword,
} from "@/lib/admin-users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Full admin only (hotel logins have a tag and cannot manage users).
async function requireSession() {
  const store = await cookies();
  const s = await verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!s || s.tag) return null;
  return s;
}

// Reset a user's password (owner sets it).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireSession()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasDatabase())
    return NextResponse.json({ error: "DATABASE_URL is not set." }, { status: 503 });

  const { id } = await params;
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Edit sends admin:false when switching someone to a hotel login; that needs a tag.
  if (body.admin === false && !String(body.tag ?? "").trim()) {
    return NextResponse.json({ error: "Hotel login needs an SMS tag, or make the user an Admin." }, { status: 400 });
  }

  // Set / clear the hotel SMS tag. Empty clears it (-> full admin). A non-empty
  // tag must be valid.
  if (Object.prototype.hasOwnProperty.call(body, "tag")) {
    const te = tagError(body.tag);
    if (te) return NextResponse.json({ error: te }, { status: 400 });
    try {
      const done = await setAdminUserTag(id, String(body.tag ?? ""));
      if (!done) return NextResponse.json({ error: "User not found." }, { status: 404 });
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ error: "Could not update tag." }, { status: 503 });
    }
  }

  // Otherwise: reset password.
  const password = String(body.password ?? "");
  if (!validPassword(password))
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  try {
    const done = await setAdminUserPassword(id, password);
    if (!done) return NextResponse.json({ error: "User not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not update password." }, { status: 503 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireSession()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasDatabase())
    return NextResponse.json({ error: "DATABASE_URL is not set." }, { status: 503 });

  const { id } = await params;
  try {
    await deleteAdminUser(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not delete user." }, { status: 503 });
  }
}
