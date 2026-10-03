"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type AdminUser = {
  id: string;
  username: string;
  sms_tag: string | null;
  created_at: string;
  last_login_at: string | null;
};

function fmt(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function UsersManager({
  users,
  envAdmin,
}: {
  users: AdminUser[];
  envAdmin: string;
}) {
  const router = useRouter();

  // create form
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [tag, setTag] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // per-row edits
  const [editId, setEditId] = useState<string | null>(null);
  const [editKind, setEditKind] = useState<"pw" | "tag">("pw");
  const [editVal, setEditVal] = useState("");
  const [rowMsg, setRowMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, tag: isAdmin ? "" : tag, admin: isAdmin }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg({ ok: true, text: `User "${username}" ban gaya.` });
        setUsername("");
        setPassword("");
        setTag("");
        setIsAdmin(false);
        router.refresh();
      } else {
        setMsg({ ok: false, text: data.error || "Failed." });
      }
    } catch {
      setMsg({ ok: false, text: "Network error." });
    }
    setBusy(false);
  }

  function startEdit(id: string, kind: "pw" | "tag", current = "") {
    setEditId(id);
    setEditKind(kind);
    setEditVal(kind === "tag" ? current : "");
    setRowMsg(null);
  }

  async function saveEdit(id: string) {
    setRowMsg(null);
    const body = editKind === "tag" ? { tag: editVal } : { password: editVal };
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setEditId(null);
        setEditVal("");
        router.refresh();
      } else {
        setRowMsg({ id, ok: false, text: data.error || "Failed." });
      }
    } catch {
      setRowMsg({ id, ok: false, text: "Network error." });
    }
  }

  async function deleteUser(id: string, name: string) {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
      else {
        const data = await res.json().catch(() => ({}));
        setRowMsg({ id, ok: false, text: data.error || "Failed." });
      }
    } catch {
      setRowMsg({ id, ok: false, text: "Network error." });
    }
  }

  const input =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none";

  return (
    <div className="space-y-6">
      {/* Create user */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-medium text-slate-700">Add a new user</p>
        <p className="mt-1 text-sm text-slate-500">
          <strong>Hotel login:</strong> SMS tag me hotel ka tag daalo jaise{" "}
          <code>Arco Team</code> (@ lagana zaroori nahi; jo text SMS me aata hai wahi) — wo user sirf
          wahi SMS dekhega. <strong>Admin</strong> checkbox on karo to full admin (sab dikhega, tag
          nahi chahiye).
        </p>
        <form onSubmit={createUser} className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[150px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">Username</label>
            <input
              className={input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. arco"
              autoComplete="off"
            />
          </div>
          <div className="min-w-[150px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">Password</label>
            <input
              className={input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="min 6 characters"
              autoComplete="new-password"
            />
          </div>
          <div className="min-w-[170px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">
              SMS tag (hotel)
            </label>
            <input
              className={`${input} ${isAdmin ? "bg-slate-100 text-slate-400" : ""}`}
              value={isAdmin ? "" : tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="@Arco Team"
              autoComplete="off"
              disabled={isAdmin}
            />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.target.checked)}
            />
            Admin
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {busy ? "Creating…" : "Create user"}
          </button>
        </form>
        {msg && (
          <p className={`mt-2 text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>
        )}
      </div>

      {/* Users list */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Hotel tag (SMS filter)</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Last login</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr className="bg-amber-50/40">
              <td className="px-4 py-3 font-medium text-slate-800">
                {envAdmin}{" "}
                <span className="ml-1 rounded bg-amber-200 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
                  built-in recovery
                </span>
              </td>
              <td className="px-4 py-3 text-slate-400">— full admin (all SMS)</td>
              <td className="px-4 py-3 text-slate-500">—</td>
              <td className="px-4 py-3 text-slate-500">—</td>
              <td className="px-4 py-3 text-right text-xs text-slate-400">
                password: use “Change password”
              </td>
            </tr>

            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Abhi koi user nahi bana. Upar se add karein.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{u.username}</td>
                  <td className="px-4 py-3">
                    {editId === u.id && editKind === "tag" ? (
                      <span className="flex items-center gap-2">
                        <input
                          className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                          value={editVal}
                          onChange={(e) => setEditVal(e.target.value)}
                          placeholder="@Arco Team (blank = admin)"
                        />
                        <button
                          onClick={() => saveEdit(u.id)}
                          className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditId(null)}
                          className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : u.sms_tag ? (
                      <span className="rounded bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700">
                        {u.sms_tag}
                      </span>
                    ) : (
                      <span className="text-slate-400">— full admin</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{fmt(u.created_at)}</td>
                  <td className="px-4 py-3 text-slate-500">{fmt(u.last_login_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-end gap-2">
                      {editId === u.id && editKind === "pw" ? (
                        <div className="flex items-center gap-2">
                          <input
                            className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                            value={editVal}
                            onChange={(e) => setEditVal(e.target.value)}
                            placeholder="new password"
                            autoComplete="new-password"
                          />
                          <button
                            onClick={() => saveEdit(u.id)}
                            className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditId(null)}
                            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            onClick={() => startEdit(u.id, "tag", u.sms_tag ?? "")}
                            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Set tag
                          </button>
                          <button
                            onClick={() => startEdit(u.id, "pw")}
                            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Reset password
                          </button>
                          <button
                            onClick={() => deleteUser(u.id, u.username)}
                            className="rounded-lg border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                      {rowMsg && rowMsg.id === u.id && (
                        <span className={`text-xs ${rowMsg.ok ? "text-green-700" : "text-red-600"}`}>
                          {rowMsg.text}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
