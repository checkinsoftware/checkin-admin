import { NextResponse } from "next/server";
import { currentBuildUser } from "@/lib/build-auth";
import { listProjects, listEntries } from "@/lib/build";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const me = await currentBuildUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  try {
    const [projects, entries] = await Promise.all([listProjects(), listEntries()]);
    return NextResponse.json({ me: { name: me.name, username: me.username }, projects, entries });
  } catch {
    return NextResponse.json({ error: "Could not load data. Is the DB set up?" }, { status: 500 });
  }
}
