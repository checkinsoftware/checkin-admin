import { NextResponse } from "next/server";
import { currentBuildUser } from "@/lib/build-auth";
import { createEntry, updateEntry, deleteEntry, isKind } from "@/lib/build";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: Request) {
  const me = await currentBuildUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const amount = Number(b.amount);
  const date = String(b.date ?? "");
  const category = String(b.category ?? "").trim();
  const party = String(b.party ?? "").trim();
  const note = String(b.note ?? "").trim();
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be greater than 0." }, { status: 400 });
  }
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  }

  const editId = b.id ? String(b.id) : "";
  try {
    if (editId) {
      const entry = await updateEntry(editId, { category, amount, date, party, note });
      if (!entry) return NextResponse.json({ error: "Entry not found." }, { status: 404 });
      return NextResponse.json({ ok: true, entry });
    }
    const projectId = String(b.projectId ?? "");
    const kind = b.kind;
    if (!projectId || !isKind(kind)) {
      return NextResponse.json({ error: "Project and type are required." }, { status: 400 });
    }
    const entry = await createEntry({ projectId, kind, category, amount, date, party, note, user: me.name });
    return NextResponse.json({ ok: true, entry });
  } catch {
    return NextResponse.json({ error: "Could not save the entry." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const me = await currentBuildUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  try {
    await deleteEntry(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not delete." }, { status: 500 });
  }
}
