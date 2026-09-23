"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BuildLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!username.trim() || !password) {
      setErr("Enter your username and password.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/build/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErr(j.error || "Login failed.");
        setBusy(false);
        return;
      }
      router.replace("/build");
    } catch {
      setErr("Network error. Try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-amber-900/70">Username</span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="rahul"
          className="h-12 rounded-xl border border-amber-200 bg-amber-50/40 px-4 text-base outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-amber-900/70">Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="h-12 rounded-xl border border-amber-200 bg-amber-50/40 px-4 text-base outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
        />
      </label>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button
        type="submit"
        disabled={busy}
        className="h-12 rounded-xl bg-amber-700 text-base font-semibold text-amber-50 disabled:opacity-60"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
