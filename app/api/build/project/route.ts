import { NextResponse } from "next/server";
import { currentBuildUser } from "@/lib/build-auth";
import { createProject, updateProject, deleteProject } from "@/lib/build";

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

export async function PATCH(req: Request) {
  const me = await currentBuildUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let id = "";
  let name = "";
  let client = "";
  try {
    const b = await req.json();
    id = String(b.id ?? "").trim();
    name = String(b.name ?? "").trim();
    client = String(b.client ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!id) return NextResponse.json({ error: "Missing project id." }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Project name is required." }, { status: 400 });

  try {
    const project = await updateProject(id, name, client);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    return NextResponse.json({ ok: true, project });
  } catch {
    return NextResponse.json({ error: "Could not update project." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const me = await currentBuildUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  try {
    await deleteProject(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not delete project." }, { status: 500 });
  }
}
