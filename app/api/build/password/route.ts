import { NextResponse } from "next/server";
import { currentBuildUser } from "@/lib/build-auth";
import { changeBuildPassword } from "@/lib/build";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const me = await currentBuildUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let current = "";
  let next = "";
  try {
    const b = await req.json();
    current = String(b.current ?? "");
    next = String(b.next ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (next.length < 4) {
    return NextResponse.json({ error: "Naya password kam se kam 4 character ka ho." }, { status: 400 });
  }

  try {
    const r = await changeBuildPassword(me.username, current, next);
    if (r === "wrong-current") return NextResponse.json({ error: "Purana password galat hai." }, { status: 400 });
    if (r === "not-found") return NextResponse.json({ error: "User not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not change the password." }, { status: 500 });
  }
}
