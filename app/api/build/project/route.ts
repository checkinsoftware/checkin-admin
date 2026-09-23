import { NextResponse } from "next/server";
import { currentBuildUser } from "@/lib/build-auth";
import { createProject } from "@/lib/build";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const me = await currentBuildUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let name = "";
  let client = "";
  try {
    const b = await req.json();
    name = String(b.name ?? "").trim();
    client = String(b.client ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!name) return NextResponse.json({ error: "Project name is required." }, { status: 400 });

  try {
    const project = await createProject(name, client);
    return NextResponse.json({ ok: true, project });
  } catch {
    return NextResponse.json({ error: "Could not create project." }, { status: 500 });
  }
}
