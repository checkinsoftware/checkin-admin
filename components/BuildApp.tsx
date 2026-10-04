"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type Project = { id: string; name: string; client: string };
type Kind = "IN" | "MAT" | "LAB";
type Entry = {
  id: string;
  projectId: string;
  kind: Kind;
  category: string;
  amount: number;
  date: string;
  party: string;
  note: string;
  user: string;
};

const MAT_CATS = ["Cement", "Steel / Sariya", "Bricks", "Sand / Gitti", "Tiles / Marble", "Electrical", "Plumbing", "Wood", "Paint", "Other"];
const LAB_CATS = ["Mason / Mistri", "Helper / Beldar", "Contractor", "Tiles work", "Painting", "Plumbing", "Electrical work", "Other"];
const MODES = ["Cash", "Bank / NEFT", "UPI", "Cheque"];
const CATPAL = ["#A85B0C", "#B0431F", "#2E6F9E", "#3B7A2E", "#8A5A2B", "#7C7261", "#9A6A9E", "#4E8C86", "#C08A2E", "#556B2F"];
const TMETA: Record<Kind, { cls: string; ic: string; word: string; catLabel: string; partyLabel: string }> = {
  IN: { cls: "in", ic: "⤵", word: "Payment received", catLabel: "Mode", partyLabel: "Received from" },
  MAT: { cls: "mat", ic: "📦", word: "Material purchase", catLabel: "Material category", partyLabel: "Vendor / shop" },
  LAB: { cls: "lab", ic: "👷", word: "Labour payment", catLabel: "Labour category", partyLabel: "Contractor / gang" },
};

const money = (n: number) => "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(n || 0));
const money0 = (n: number) => money(n).slice(1);
function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00");
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}
function totals(list: Entry[]) {
  let inn = 0, mat = 0, lab = 0;
  for (const e of list) {
    if (e.kind === "IN") inn += e.amount;
    else if (e.kind === "MAT") mat += e.amount;
    else lab += e.amount;
  }
  return { inn, mat, lab, exp: mat + lab, bal: inn - mat - lab };
}
function byCat(list: Entry[], kind: Kind): [string, number][] {
  const m: Record<string, number> = {};
  for (const e of list) if (e.kind === kind) { const k = e.category || "Other"; m[k] = (m[k] || 0) + e.amount; }
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}
function csvCell(s: string | number) {
  const v = String(s ?? "");
  return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}
function downloadText(filename: string, text: string, type = "text/csv;charset=utf-8") {
  try {
    const blob = new Blob(["﻿" + text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch { /* ignore */ }
}
function todayISO() { return new Date().toISOString().slice(0, 10); }

type View = { name: "projects" } | { name: "project"; id: string } | { name: "report"; pid?: string };
type SheetState =
  | { kind: "entry"; type: Kind; projectId: string; editId?: string }
  | { kind: "project" }
  | { kind: "editProject"; id: string }
  | { kind: "user" }
  | null;

const KIND_WORD: Record<Kind, string> = { IN: "Payment", MAT: "Material", LAB: "Labour" };

export default function BuildApp({ meName }: { meName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [view, setView] = useState<View>({ name: "projects" });
  const [sheet, setSheet] = useState<SheetState>(null);

  const reload = useCallback(async () => {
    try {
      const r = await fetch("/api/build/data", { cache: "no-store" });
      if (r.status === 401) { router.replace("/build/login"); return; }
      const j = await r.json();
      if (!r.ok) { setLoadErr(j.error || "Could not load."); setLoading(false); return; }
      setProjects(j.projects || []);
      setEntries(j.entries || []);
      setLoading(false);
    } catch {
      setLoadErr("Network error.");
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { reload(); }, [reload]);

  const entriesOf = useCallback((pid?: string) => (pid ? entries.filter((e) => e.projectId === pid) : entries), [entries]);

  async function logout() {
    await fetch("/api/build/logout", { method: "POST" });
    router.replace("/build/login");
  }

  if (loading) {
    return (
      <div className="bk">
        <style>{BK_CSS}</style>
        <div className="bk-load">Loading…</div>
      </div>
    );
  }

  return (
    <div className="bk">
      <style>{BK_CSS}</style>
      <div className="app">
        <Header view={view} setView={setView} meName={meName} openUser={() => setSheet({ kind: "user" })} projects={projects} editProject={(id) => setSheet({ kind: "editProject", id })} />
        <main>
          {loadErr && <div className="empty" style={{ color: "var(--out)" }}>{loadErr}</div>}
          {view.name === "projects" && (
            <ProjectsView projects={projects} entries={entries} entriesOf={entriesOf} open={(id) => setView({ name: "project", id })} newProject={() => setSheet({ kind: "project" })} />
          )}
          {view.name === "project" && (
            <ProjectView project={projects.find((p) => p.id === view.id)} list={entriesOf(view.id)} openEntry={(type, editId) => setSheet({ kind: "entry", type, projectId: view.id, editId })} />
          )}
          {view.name === "report" && (
            <ReportView projects={projects} entries={entries} pid={view.pid || ""} setPid={(pid) => setView({ name: "report", pid })} entriesOf={entriesOf} />
          )}
        </main>
        <nav className="tabs">
          <button className={view.name === "projects" || view.name === "project" ? "on" : ""} onClick={() => setView({ name: "projects" })}>
            <span className="ic">🏗</span>Projects
          </button>
          <button className={view.name === "report" ? "on" : ""} onClick={() => setView({ name: "report" })}>
            <span className="ic">📊</span>Reports
          </button>
        </nav>
      </div>

      {sheet?.kind === "user" && <UserSheet meName={meName} onClose={() => setSheet(null)} onLogout={logout} />}
      {sheet?.kind === "project" && <ProjectSheet onClose={() => setSheet(null)} onSaved={(p) => { setProjects((x) => [...x, p]); setSheet(null); setView({ name: "project", id: p.id }); }} />}
      {sheet?.kind === "editProject" && (
        <ProjectEditSheet
          project={projects.find((p) => p.id === sheet.id)}
          entryCount={entries.filter((e) => e.projectId === sheet.id).length}
          onClose={() => setSheet(null)}
          onSaved={(p) => { setProjects((x) => x.map((q) => (q.id === p.id ? p : q))); setSheet(null); }}
          onDeleted={(id) => { setProjects((x) => x.filter((q) => q.id !== id)); setEntries((x) => x.filter((e) => e.projectId !== id)); setSheet(null); setView({ name: "projects" }); }}
        />
      )}
      {sheet?.kind === "entry" && (
        <EntrySheet
          sheet={sheet}
          entry={sheet.editId ? entries.find((e) => e.id === sheet.editId) : undefined}
          meName={meName}
          onClose={() => setSheet(null)}
          onSaved={() => { setSheet(null); reload(); }}
        />
      )}
    </div>
  );
}

function Header({ view, setView, meName, openUser, projects, editProject }: { view: View; setView: (v: View) => void; meName: string; openUser: () => void; projects: Project[]; editProject: (id: string) => void }) {
  if (view.name === "project") {
    const p = projects.find((x) => x.id === view.id);
    return (
      <header>
        <button className="hbtn" onClick={() => setView({ name: "projects" })}>‹</button>
        <div className="grow">
          <div className="htitle">{p?.name}</div>
          <div className="sub">{p?.client}</div>
        </div>
        <button className="hbtn" aria-label="Edit project" onClick={() => editProject(view.id)}>✎</button>
      </header>
    );
  }
  return (
    <header>
      <div className="grow">
        <div className="wm">📒 BuildKhata</div>
        <div className="sub">{view.name === "report" ? "Reports & totals" : "Builder expense book"}</div>
      </div>
      <button className="userchip" onClick={openUser}>
        <span className="ava sm">{meName[0]}</span>
        {meName} ▾
      </button>
    </header>
  );
}

function Hero({ label, bal, inn, exp, mat, lab }: { label: string; bal: number; inn: number; exp: number; mat?: number; lab?: number }) {
  return (
    <div className="hero">
      <div className="lab">{label}</div>
      <div className="big tnum" style={{ color: bal >= 0 ? "var(--in)" : "var(--out)" }}>{money(bal)}</div>
      <div className="grid2" style={{ marginTop: 12 }}>
        <div className="stat in"><div className="l">Payment received</div><div className="v tnum">{money(inn)}</div></div>
        <div className="stat out"><div className="l">Total expense</div><div className="v tnum">{money(exp)}</div></div>
      </div>
      {mat !== undefined && (
        <div className="split" style={{ marginTop: 9 }}>
          <span>📦 Material {money(mat)}</span><span>👷 Labour {money(lab || 0)}</span>
        </div>
      )}
    </div>
  );
}

function CatCard({ title, list, kind, tot }: { title: string; list: Entry[]; kind: Kind; tot: number }) {
  const rows = byCat(list, kind);
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => r[1]));
  return (
    <div className="card cpad">
      <div className="cathead">
        <div className="eyebrow">{title}</div>
        <div className="tnum" style={{ fontWeight: 700, color: kind === "MAT" ? "var(--brand)" : "var(--lab-ink)" }}>{money(tot)}</div>
      </div>
      {rows.map((r, i) => {
        const c = CATPAL[i % CATPAL.length];
        return (
          <div key={r[0]}>
            <div className="catrow"><span className="dot" style={{ background: c }} /><span className="nm">{r[0]}</span><span className="amt tnum">{money(r[1])}</span></div>
            <div className="bar"><i style={{ width: `${Math.max(6, (r[1] / max) * 100)}%`, background: c }} /></div>
          </div>
        );
      })}
    </div>
  );
}

function EntryRow({ e, onClick }: { e: Entry; onClick: () => void }) {
  const M = TMETA[e.kind];
  const sub = [e.category, e.party && "· " + e.party, fmtDate(e.date), "· " + e.user].filter(Boolean).join(" ");
  return (
    <button className="entry" onClick={onClick}>
      <span className={"ebadge " + M.cls}>{M.ic}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="t1">{e.category || M.word}</div>
        <div className="t2">{sub}</div>
      </div>
      <span className={"amt tnum " + (e.kind === "IN" ? "pin" : "pout")}>{e.kind === "IN" ? "+" : "−"}{money0(e.amount)}</span>
    </button>
  );
}

function ProjectsView({ projects, entries, entriesOf, open, newProject }: { projects: Project[]; entries: Entry[]; entriesOf: (id?: string) => Entry[]; open: (id: string) => void; newProject: () => void }) {
  const g = totals(entries);
  return (
    <>
      <div className="sec-h"><h3>Your projects</h3><button className="pill" onClick={newProject}>＋ New project</button></div>
      <div className="hero">
        <div className="lab">Overall balance · all projects</div>
        <div className="big tnum" style={{ color: g.bal >= 0 ? "var(--in)" : "var(--out)" }}>{money(g.bal)}</div>
        <div className="grid2" style={{ marginTop: 12 }}>
          <div className="stat in"><div className="l">Received</div><div className="v tnum">{money(g.inn)}</div></div>
          <div className="stat out"><div className="l">Expense</div><div className="v tnum">{money(g.exp)}</div></div>
        </div>
      </div>
      {projects.length ? (
        <div className="card">
          {projects.map((p) => {
            const t = totals(entriesOf(p.id));
            return (
              <button key={p.id} className="pcard" onClick={() => open(p.id)}>
                <div><div className="nm">{p.name}</div><div className="cl">{p.client}</div></div>
                <div className="bal"><div className="b tnum" style={{ color: t.bal >= 0 ? "var(--in)" : "var(--out)" }}>{money(t.bal)}</div><div className="t">balance</div></div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="empty">No projects yet. Tap “New project”.</div>
      )}
    </>
  );
}

function ProjectView({ project, list, openEntry }: { project?: Project; list: Entry[]; openEntry: (type: Kind, editId?: string) => void }) {
  const sorted = [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const t = totals(list);
  return (
    <>
      <Hero label="Balance · received − expense" bal={t.bal} inn={t.inn} exp={t.exp} mat={t.mat} lab={t.lab} />
      <div className="acts">
        <button className="act in" onClick={() => openEntry("IN")}><span className="ic">＋</span>Payment</button>
        <button className="act mat" onClick={() => openEntry("MAT")}><span className="ic">＋</span>Purchase</button>
        <button className="act lab" onClick={() => openEntry("LAB")}><span className="ic">＋</span>Labour</button>
      </div>
      <CatCard title="Material by category" list={list} kind="MAT" tot={t.mat} />
      <CatCard title="Labour by category" list={list} kind="LAB" tot={t.lab} />
      <div className="sec-h"><h3>Entries</h3><span className="faint" style={{ fontSize: 12 }}>{list.length} total</span></div>
      <div className="card">
        {sorted.length ? sorted.map((e) => <EntryRow key={e.id} e={e} onClick={() => openEntry(e.kind, e.id)} />) : <div className="empty">No entries yet. Use the buttons above.</div>}
      </div>
    </>
  );
}

function ReportView({ projects, entries, pid, setPid, entriesOf }: { projects: Project[]; entries: Entry[]; pid: string; setPid: (p: string) => void; entriesOf: (id?: string) => Entry[] }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const projName = useMemo(() => { const m: Record<string, string> = {}; projects.forEach((p) => (m[p.id] = p.name)); return m; }, [projects]);

  const list = useMemo(() => {
    let l = entriesOf(pid || undefined);
    if (from) l = l.filter((e) => e.date >= from);
    if (to) l = l.filter((e) => e.date <= to);
    return l;
  }, [entriesOf, pid, from, to]);

  const sorted = useMemo(() => [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)), [list]);
  const t = totals(list);
  const um: Record<string, { inn: number; exp: number }> = {};
  for (const e of list) { um[e.user] = um[e.user] || { inn: 0, exp: 0 }; if (e.kind === "IN") um[e.user].inn += e.amount; else um[e.user].exp += e.amount; }
  const urows = Object.entries(um).sort((a, b) => (b[1].inn + b[1].exp) - (a[1].inn + a[1].exp));

  const scopeName = pid ? (projName[pid] || "Project") : "All projects";
  const rangeText = from || to ? `${from ? fmtDate(from) : "start"} – ${to ? fmtDate(to) : "today"}` : "All dates";

  function quick(kind: "month" | "all") {
    if (kind === "all") { setFrom(""); setTo(""); return; }
    const d = new Date(); const y = d.getFullYear(), m = d.getMonth();
    setFrom(new Date(y, m, 1).toLocaleDateString("en-CA"));
    setTo(todayISO());
  }
  function exportCSV() {
    const head = ["Date", "Type", "Category", "Party", "Note", "Amount", "By user", "Project"];
    const lines = [head.join(",")];
    for (const e of sorted) {
      lines.push([csvCell(e.date), KIND_WORD[e.kind], csvCell(e.category), csvCell(e.party), csvCell(e.note),
        (e.kind === "IN" ? "" : "-") + e.amount, csvCell(e.user), csvCell(projName[e.projectId] || "")].join(","));
    }
    lines.push("");
    lines.push(["", "", "", "", "Received", t.inn].join(","));
    lines.push(["", "", "", "", "Expense", t.exp].join(","));
    lines.push(["", "", "", "", "Balance", t.bal].join(","));
    downloadText(`BuildKhata_${scopeName.replace(/[^\w]+/g, "_")}.csv`, lines.join("\n"));
  }

  return (
    <>
      <div className="screen-only" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="field" style={{ marginTop: 0 }}>
          <label>Project</label>
          <select value={pid} onChange={(e) => setPid(e.target.value)}>
            <option value="">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="grid2">
          <div className="field" style={{ marginTop: 0 }}><label>From date</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="field" style={{ marginTop: 0 }}><label>To date</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="pill" onClick={() => quick("month")}>This month</button>
          <button className="pill" onClick={() => quick("all")}>All dates</button>
        </div>

        <Hero label={`Balance · ${rangeText}`} bal={t.bal} inn={t.inn} exp={t.exp} mat={t.mat} lab={t.lab} />
        <CatCard title="Material — category-wise total" list={list} kind="MAT" tot={t.mat} />
        <CatCard title="Labour — category-wise total" list={list} kind="LAB" tot={t.lab} />
        <div className="card cpad">
          <div className="eyebrow" style={{ marginBottom: 4 }}>Entries by user</div>
          {urows.map(([u, v]) => (
            <div className="catrow" key={u}>
              <span className="ava">{u[0]}</span>
              <span className="nm">{u}</span>
              <span style={{ fontSize: 12, color: "var(--in-ink)" }}>+{money0(v.inn)}</span>
              <span className="amt tnum" style={{ color: "var(--out)" }}>−{money0(v.exp)}</span>
            </div>
          ))}
          {!urows.length && <div className="empty">No entries in this range.</div>}
        </div>

        <div className="srow" style={{ marginTop: 0 }}>
          <button className="btn ghost" onClick={exportCSV}>⬇ CSV</button>
          <button className="btn primary" onClick={() => window.print()}>🖨 Print / Share PDF</button>
        </div>
        <div className="faint" style={{ fontSize: 11.5, textAlign: "center", marginTop: -4 }}>Print par “Save as PDF” choose karke WhatsApp par bhej sakte ho.</div>
      </div>

      <Statement scope={scopeName} range={rangeText} list={sorted} totals={t} projName={projName} />
    </>
  );
}

function Statement({ scope, range, list, totals: t, projName }: { scope: string; range: string; list: Entry[]; totals: ReturnType<typeof totals>; projName: Record<string, string> }) {
  const mat = byCat(list, "MAT"), lab = byCat(list, "LAB");
  return (
    <div className="print-only stmt">
      <div className="stmt-head">
        <div className="stmt-title">BuildKhata — Statement</div>
        <div className="stmt-meta">{scope} · {range}<br />Generated {fmtDate(todayISO())}</div>
      </div>
      <table className="stmt-sum">
        <tbody>
          <tr><td>Payment received</td><td className="r">{money(t.inn)}</td></tr>
          <tr><td>Material</td><td className="r">{money(t.mat)}</td></tr>
          <tr><td>Labour</td><td className="r">{money(t.lab)}</td></tr>
          <tr><td>Total expense</td><td className="r">{money(t.exp)}</td></tr>
          <tr className="bold"><td>Balance</td><td className="r">{money(t.bal)}</td></tr>
        </tbody>
      </table>
      {mat.length > 0 && <StmtCatTable title="Material by category" rows={mat} />}
      {lab.length > 0 && <StmtCatTable title="Labour by category" rows={lab} />}
      <div className="stmt-sec">All entries ({list.length})</div>
      <table className="stmt-tbl">
        <thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Party</th><th className="r">Amount</th><th>By</th></tr></thead>
        <tbody>
          {list.map((e) => (
            <tr key={e.id}>
              <td>{fmtDate(e.date)}</td><td>{KIND_WORD[e.kind]}</td><td>{e.category}</td><td>{e.party}</td>
              <td className="r">{e.kind === "IN" ? "" : "-"}{money0(e.amount)}</td><td>{e.user}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StmtCatTable({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <>
      <div className="stmt-sec">{title}</div>
      <table className="stmt-tbl">
        <tbody>{rows.map((r) => <tr key={r[0]}><td>{r[0]}</td><td className="r">{money(r[1])}</td></tr>)}</tbody>
      </table>
    </>
  );
}

/* ---------- sheets ---------- */
function Scrim({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}><div className="sheet">{children}</div></div>;
}

function UserSheet({ meName, onClose, onLogout }: { meName: string; onClose: () => void; onLogout: () => void }) {
  return (
    <Scrim onClose={onClose}>
      <div className="grab" />
      <h2>Account</h2>
      <div className="userrow"><span className="ava">{meName[0]}</span><div><div style={{ fontWeight: 600 }}>{meName}</div><div className="faint" style={{ fontSize: 12 }}>Signed in</div></div></div>
      <div className="srow">
        <button className="btn ghost" onClick={onClose}>Close</button>
        <button className="btn danger-full" onClick={onLogout}>Log out</button>
      </div>
    </Scrim>
  );
}

function ProjectSheet({ onClose, onSaved }: { onClose: () => void; onSaved: (p: Project) => void }) {
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!name.trim()) { setErr("Enter a project name."); return; }
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/build/project", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, client }) });
      const j = await r.json();
      if (!r.ok) { setErr(j.error || "Could not create."); setBusy(false); return; }
      onSaved(j.project);
    } catch { setErr("Network error."); setBusy(false); }
  }
  return (
    <Scrim onClose={onClose}>
      <div className="grab" />
      <h2>New project</h2>
      <div className="field"><label>Project name</label><input value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} placeholder="e.g. Villa – Verma Ji" /></div>
      <div className="field"><label>Client</label><input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Owner / party name" /></div>
      {err && <div className="err show">{err}</div>}
      <div className="srow">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Create"}</button>
      </div>
    </Scrim>
  );
}

function ProjectEditSheet({ project, entryCount, onClose, onSaved, onDeleted }: { project?: Project; entryCount: number; onClose: () => void; onSaved: (p: Project) => void; onDeleted: (id: string) => void }) {
  const [name, setName] = useState(project?.name || "");
  const [client, setClient] = useState(project?.client || "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  if (!project) return null;

  async function save() {
    if (!name.trim()) { setErr("Enter a project name."); return; }
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/build/project", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: project!.id, name, client }) });
      const j = await r.json();
      if (!r.ok) { setErr(j.error || "Could not save."); setBusy(false); return; }
      onSaved(j.project);
    } catch { setErr("Network error."); setBusy(false); }
  }
  async function del() {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/build/project?id=" + project!.id, { method: "DELETE" });
      if (!r.ok) { const j = await r.json().catch(() => ({})); setErr(j.error || "Could not delete."); setBusy(false); return; }
      onDeleted(project!.id);
    } catch { setErr("Network error."); setBusy(false); }
  }

  return (
    <Scrim onClose={onClose}>
      <div className="grab" />
      <h2>Edit project</h2>
      <div className="field"><label>Project name</label><input value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} placeholder="Project name" /></div>
      <div className="field"><label>Client</label><input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Owner / party name" /></div>
      {err && <div className="err show">{err}</div>}
      <div className="srow">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      </div>

      {!confirmDel ? (
        <button className="btn danger-full" style={{ width: "100%", marginTop: 10 }} onClick={() => setConfirmDel(true)}>🗑 Delete this project</button>
      ) : (
        <div className="delbox">
          <div style={{ fontSize: 13, color: "var(--out-ink)", marginBottom: 10 }}>
            Pakka delete karein? <strong>{project.name}</strong> aur iski <strong>{entryCount}</strong> entries hamesha ke liye hat jaayengi.
          </div>
          <div className="srow" style={{ marginTop: 0 }}>
            <button className="btn ghost" onClick={() => setConfirmDel(false)} disabled={busy}>Rehne do</button>
            <button className="btn danger-full" onClick={del} disabled={busy}>{busy ? "Deleting…" : "Haan, delete karo"}</button>
          </div>
        </div>
      )}
    </Scrim>
  );
}

function EntrySheet({ sheet, entry, meName, onClose, onSaved }: { sheet: { type: Kind; projectId: string; editId?: string }; entry?: Entry; meName: string; onClose: () => void; onSaved: () => void }) {
  const M = TMETA[sheet.type];
  const cats = sheet.type === "IN" ? MODES : sheet.type === "MAT" ? MAT_CATS : LAB_CATS;
  const today = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = useState(entry ? String(entry.amount) : "");
  const [category, setCategory] = useState(entry?.category || "");
  const [date, setDate] = useState(entry?.date || today);
  const [party, setParty] = useState(entry?.party || "");
  const [note, setNote] = useState(entry?.note || "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    const amt = parseFloat((amount || "").replace(/[^0-9.]/g, ""));
    if (!amt || amt <= 0) { setErr("Enter an amount greater than 0."); return; }
    setBusy(true); setErr("");
    const body: Record<string, unknown> = { amount: amt, category, date, party, note };
    if (sheet.editId) body.id = sheet.editId;
    else { body.projectId = sheet.projectId; body.kind = sheet.type; }
    try {
      const r = await fetch("/api/build/entry", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) { setErr(j.error || "Could not save."); setBusy(false); return; }
      onSaved();
    } catch { setErr("Network error."); setBusy(false); }
  }
  async function del() {
    if (!sheet.editId) return;
    setBusy(true);
    try { await fetch("/api/build/entry?id=" + sheet.editId, { method: "DELETE" }); onSaved(); }
    catch { setErr("Network error."); setBusy(false); }
  }

  const listId = "dl_" + sheet.type;
  return (
    <Scrim onClose={onClose}>
      <div className="grab" />
      <h2><span className={"ebadge " + M.cls} style={{ width: 30, height: 30, fontSize: 15 }}>{M.ic}</span>{M.word}</h2>
      <div className="field"><label>Amount (₹)</label><input className="amt-in tnum" inputMode="numeric" value={amount} onChange={(e) => { setAmount(e.target.value); setErr(""); }} placeholder="0" /></div>
      <div className="field"><label>{M.catLabel}</label><input list={listId} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Choose or type…" /><datalist id={listId}>{cats.map((c) => <option key={c} value={c} />)}</datalist></div>
      <div className="field"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="field"><label>{M.partyLabel}</label><input value={party} onChange={(e) => setParty(e.target.value)} placeholder="Name" /></div>
      <div className="field"><label>Note (optional)</label><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 200 bag @ 360" /></div>
      {err && <div className="err show">{err}</div>}
      <div className="srow">
        {sheet.editId && <button className="btn danger" onClick={del} disabled={busy}>🗑</button>}
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save} disabled={busy}>{busy ? "…" : sheet.editId ? "Update" : "Save"}</button>
      </div>
      <div className="demo">{sheet.editId ? "" : "Saving as " + meName}</div>
    </Scrim>
  );
}

const BK_CSS = `
.bk{--bg:#F5F1E9;--surface:#fff;--surface-2:#FBF8F2;--line:#E7E0D3;--ink:#2A2419;--muted:#7C7261;--faint:#A79C88;
--brand:#A85B0C;--brand-ink:#F7EBD9;--brand-soft:#F4E6CE;--in:#3B7A2E;--in-soft:#E7F1DC;--in-ink:#2C5C22;
--out:#B0431F;--out-soft:#F7E3D8;--out-ink:#8A3417;--lab:#2E6F9E;--lab-soft:#E1EEF8;--lab-ink:#245984;
--shadow:0 1px 2px rgba(42,36,25,.06),0 8px 24px rgba(42,36,25,.06);--r:14px;
font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:var(--ink);}
@media (prefers-color-scheme:dark){.bk{--bg:#14110B;--surface:#201B13;--surface-2:#1A160F;--line:#312A1E;--ink:#EFE7D6;--muted:#A99E88;--faint:#7A7059;
--brand:#E29A45;--brand-ink:#2A1B08;--brand-soft:#3A2B14;--in:#8FCB6E;--in-soft:#25331B;--in-ink:#B9E29E;
--out:#E88A63;--out-soft:#3A241A;--out-ink:#F2B79C;--lab:#79B2E0;--lab-soft:#1C2A38;--lab-ink:#AFD3F0;
--shadow:0 1px 2px rgba(0,0,0,.3),0 10px 26px rgba(0,0,0,.35);}}
.bk *{box-sizing:border-box}
.bk .app{max-width:520px;margin:0 auto;min-height:100vh;display:flex;flex-direction:column;background:var(--bg)}
.bk .bk-load{padding:60px;text-align:center;color:var(--muted)}
.bk .tnum{font-variant-numeric:tabular-nums}
.bk button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}
.bk input,.bk select{font-family:inherit;font-size:16px;color:var(--ink)}
.bk header{position:sticky;top:0;z-index:20;background:var(--brand);color:var(--brand-ink);padding:14px 16px;display:flex;align-items:center;gap:12px;box-shadow:var(--shadow)}
.bk header .wm{font-family:Georgia,"Times New Roman",serif;font-weight:600;font-size:20px;display:flex;align-items:center;gap:8px}
.bk header .sub{font-size:12px;opacity:.85;margin-top:1px}
.bk header .hbtn{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.15);font-size:22px;flex:0 0 auto}
.bk header .grow{flex:1;min-width:0}
.bk header .htitle{font-weight:600;font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bk .userchip{font-size:12px;background:rgba(255,255,255,.16);padding:6px 10px;border-radius:20px;display:flex;align-items:center;gap:6px;color:var(--brand-ink)}
.bk .ava{width:26px;height:26px;border-radius:50%;background:var(--brand-soft);color:var(--brand);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;text-transform:uppercase}
.bk .ava.sm{width:20px;height:20px;font-size:10px}
.bk main{flex:1;padding:16px;display:flex;flex-direction:column;gap:14px}
.bk .faint{color:var(--faint)}
.bk .eyebrow{font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--faint)}
.bk .card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--shadow)}
.bk .cpad{padding:13px 15px}
.bk .pcard{padding:14px 16px;display:flex;align-items:center;gap:14px;width:100%;text-align:left;border-top:1px solid var(--line)}
.bk .card .pcard:first-child{border-top:none}
.bk .pcard .nm{font-weight:600;font-size:16px}
.bk .pcard .cl{font-size:12.5px;color:var(--muted);margin-top:1px}
.bk .pcard .bal{margin-left:auto;text-align:right}
.bk .pcard .bal .b{font-weight:700;font-size:16px}
.bk .pcard .bal .t{font-size:11px;color:var(--faint)}
.bk .hero{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:16px;box-shadow:var(--shadow)}
.bk .hero .lab{font-size:12.5px;color:var(--muted)}
.bk .hero .big{font-family:Georgia,serif;font-weight:600;font-size:34px;margin-top:2px}
.bk .grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.bk .stat{border-radius:12px;padding:11px 13px}
.bk .stat .l{font-size:11.5px;font-weight:600}
.bk .stat .v{font-weight:700;font-size:17px;margin-top:2px}
.bk .stat.in{background:var(--in-soft);color:var(--in-ink)}
.bk .stat.out{background:var(--out-soft);color:var(--out-ink)}
.bk .split{display:flex;justify-content:space-between;font-size:12px;color:var(--muted);padding:0 3px}
.bk .acts{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
.bk .act{border-radius:12px;padding:12px 6px;display:flex;flex-direction:column;align-items:center;gap:5px;font-size:12.5px;font-weight:600}
.bk .act .ic{font-size:19px;line-height:1}
.bk .act.in{background:var(--in-soft);color:var(--in-ink)}
.bk .act.mat{background:var(--brand-soft);color:var(--brand)}
.bk .act.lab{background:var(--lab-soft);color:var(--lab-ink)}
.bk .act:active{transform:scale(.97)}
.bk .cathead{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px}
.bk .catrow{display:flex;align-items:center;gap:10px;padding:9px 0}
.bk .catrow .dot{width:9px;height:9px;border-radius:3px;flex:0 0 auto}
.bk .catrow .nm{flex:1;font-size:14px}
.bk .catrow .amt{font-weight:600;font-size:14px}
.bk .bar{height:6px;border-radius:4px;background:var(--line);overflow:hidden;margin:-2px 0 4px}
.bk .bar>i{display:block;height:100%;border-radius:4px}
.bk .entry{display:flex;align-items:center;gap:12px;padding:11px 13px;width:100%;text-align:left;border-top:1px solid var(--line)}
.bk .card .entry:first-child{border-top:none}
.bk .entry:active{background:var(--surface-2)}
.bk .ebadge{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:17px;flex:0 0 auto}
.bk .ebadge.in{background:var(--in-soft);color:var(--in-ink)}
.bk .ebadge.mat{background:var(--brand-soft);color:var(--brand)}
.bk .ebadge.lab{background:var(--lab-soft);color:var(--lab-ink)}
.bk .entry .t1{font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bk .entry .t2{font-size:11.5px;color:var(--muted);margin-top:1px}
.bk .entry .amt{margin-left:auto;font-weight:700;font-size:14.5px;white-space:nowrap}
.bk .amt.pin{color:var(--in)}.bk .amt.pout{color:var(--out)}
.bk .sec-h{display:flex;align-items:center;justify-content:space-between;margin:2px 2px -2px}
.bk .sec-h h3{font-family:Georgia,serif;font-weight:600;font-size:16px;margin:0}
.bk .empty{text-align:center;color:var(--muted);padding:26px 10px;font-size:14px}
.bk .pill{font-size:12px;color:var(--muted);background:var(--surface-2);border:1px solid var(--line);padding:6px 11px;border-radius:20px}
.bk nav.tabs{position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--line);display:flex;padding:6px 8px;gap:4px;z-index:20}
.bk nav.tabs button{flex:1;padding:8px 4px;border-radius:11px;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;font-weight:600;color:var(--muted)}
.bk nav.tabs button .ic{font-size:20px}
.bk nav.tabs button.on{color:var(--brand);background:var(--brand-soft)}
.bk .scrim{position:fixed;inset:0;background:rgba(20,15,8,.45);z-index:40;display:flex;align-items:flex-end;justify-content:center}
.bk .sheet{background:var(--surface);width:100%;max-width:520px;border-radius:20px 20px 0 0;padding:14px 16px 20px;max-height:92vh;overflow:auto}
.bk .grab{width:40px;height:4px;border-radius:3px;background:var(--line);margin:2px auto 12px}
.bk .sheet h2{font-family:Georgia,serif;font-weight:600;font-size:19px;margin:0 0 2px;display:flex;align-items:center;gap:9px}
.bk .userrow{display:flex;align-items:center;gap:12px;margin-top:14px}
.bk .field{margin-top:14px}
.bk .field label{display:block;font-size:12.5px;font-weight:600;color:var(--muted);margin-bottom:5px}
.bk .field input,.bk .field select{width:100%;height:46px;border:1px solid var(--line);border-radius:11px;padding:0 13px;background:var(--surface-2)}
.bk .field input:focus,.bk .field select:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-soft)}
.bk .field .amt-in{font-size:22px;font-weight:700;height:54px}
.bk .err{color:var(--out);font-size:12.5px;margin-top:8px;display:none}
.bk .err.show{display:block}
.bk .srow{display:flex;gap:10px;margin-top:18px}
.bk .btn{flex:1;height:50px;border-radius:13px;font-size:16px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px}
.bk .btn.primary{background:var(--brand);color:var(--brand-ink)}
.bk .btn.ghost{background:var(--surface-2);color:var(--muted);border:1px solid var(--line)}
.bk .btn.danger{background:var(--out-soft);color:var(--out-ink);flex:0 0 auto;width:54px}
.bk .btn.danger-full{background:var(--out-soft);color:var(--out-ink)}
.bk .btn:active{transform:scale(.98)}
.bk .btn:disabled{opacity:.6}
.bk .demo{font-size:11.5px;color:var(--faint);text-align:center;padding:8px 0 2px}
.bk .delbox{margin-top:12px;padding:12px 14px;border:1px solid var(--out-soft);background:var(--out-soft);border-radius:12px}
.bk .print-only{display:none}
@media print{
  .bk header,.bk nav.tabs,.bk .screen-only,.bk .scrim{display:none!important}
  .bk main{padding:0!important}
  .bk .app{min-height:0!important;background:#fff!important}
  .bk .print-only{display:block!important}
}
.bk .stmt{color:#1a1a1a;font-size:12px}
.bk .stmt-head{border-bottom:2px solid #A85B0C;padding-bottom:8px;margin-bottom:12px}
.bk .stmt-title{font-family:Georgia,serif;font-size:20px;font-weight:600;color:#854F0B}
.bk .stmt-meta{font-size:11px;color:#555;margin-top:3px}
.bk .stmt-sec{font-weight:700;font-size:12px;margin:14px 0 4px;color:#854F0B}
.bk .stmt-sum{border-collapse:collapse;width:100%;max-width:340px;margin-bottom:6px}
.bk .stmt-sum td{padding:4px 2px;border-bottom:1px solid #eee;font-size:13px}
.bk .stmt-sum tr.bold td{font-weight:700;border-top:2px solid #333;border-bottom:none;font-size:14px}
.bk .stmt-tbl{border-collapse:collapse;width:100%}
.bk .stmt-tbl th{text-align:left;font-size:10.5px;color:#666;border-bottom:1px solid #999;padding:4px}
.bk .stmt-tbl td{font-size:11px;padding:3px 4px;border-bottom:1px solid #eee}
.bk .stmt .r{text-align:right;font-variant-numeric:tabular-nums}
`;
