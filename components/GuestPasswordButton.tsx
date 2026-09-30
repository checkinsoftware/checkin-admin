"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Lets an admin set/reset a guest's password. The admin only ever sets a new
// one — the existing password is never shown or sent back, only its hash is
// stored (same as admin panel logins).
export default function GuestPasswordButton({
  mobile,
  hasPassword,
}: {
  mobile: string;
  hasPassword: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (value.length < 4) {
      setErr("Kam se kam 4 characters.");
      return;
    }
    setBusy(true);
    setErr("");
    const res = await fetch("/api/admin/webusers/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile, password: value }),
    });
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      setValue("");
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setErr(d.error || "Save failed.");
    }
  }

  async function clear() {
    setBusy(true);
    const res = await fetch("/api/admin/webusers/password", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  if (open) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <input
          type="text"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="naya password"
          className="w-28 rounded border border-slate-300 px-1.5 py-0.5 text-xs"
        />
        <button className="btn-ghost-sm" disabled={busy} onClick={save}>
          {busy ? "…" : "Save"}
        </button>
        <button className="btn-ghost-sm" onClick={() => { setOpen(false); setErr(""); }}>
          Cancel
        </button>
        {err && <span className="text-xs text-red-600">{err}</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`rounded px-2 py-0.5 text-xs font-semibold ${
          hasPassword ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
        }`}
      >
        {hasPassword ? "Set" : "Not set"}
      </span>
      <button className="btn-ghost-sm" onClick={() => setOpen(true)}>
        {hasPassword ? "Reset" : "Set password"}
      </button>
      {hasPassword && (
        <button className="btn-ghost-sm" disabled={busy} onClick={clear}>
          Clear
        </button>
      )}
    </span>
  );
}
