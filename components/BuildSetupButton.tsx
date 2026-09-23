"use client";

import { useState } from "react";

export default function BuildSetupButton() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function run() {
    setFailed(false);
    setMsg(null);
    if (password.trim().length < 4) {
      setFailed(true);
      setMsg("Password kam se kam 4 character ka do.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/build-setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: password.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFailed(true);
        setMsg(data.error || "Setup failed.");
      } else {
        setMsg(`✓ Ho gaya — 5 users ready (${(data.users || []).join(", ")}). Ab sabhi is password se login kar sakte hain.`);
      }
    } catch {
      setFailed(true);
      setMsg("Network error. Dobara try karein.");
    }
    setBusy(false);
  }

  return (
    <div className="max-w-md">
      <label className="block text-sm font-medium text-slate-700">
        Sabhi 5 users ka password
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="jaise: arco@2026"
          className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-base outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
        />
      </label>
      <button
        onClick={run}
        disabled={busy}
        className="mt-3 rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-800 disabled:opacity-60"
      >
        {busy ? "Ban raha hai…" : "Create tables + 5 users"}
      </button>
      {msg && <p className={`mt-3 text-sm ${failed ? "text-red-700" : "text-emerald-700"}`}>{msg}</p>}
    </div>
  );
}
