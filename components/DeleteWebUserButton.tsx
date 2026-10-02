"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Two-step delete for a guest account. Their SMS history is kept.
export default function DeleteWebUserButton({ mobile }: { mobile: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    const res = await fetch("/api/admin/webusers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile }),
    });
    if (res.ok) router.push("/mng-x7k9/webusers");
    else setBusy(false);
  }

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
      >
        Delete account
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2 text-sm">
      <span className="text-slate-600">Delete {mobile}? Their SMS history stays.</span>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
      >
        {busy ? "…" : "Yes, delete"}
      </button>
      <button type="button" onClick={() => setAsking(false)} className="text-xs text-slate-500 hover:underline">
        Cancel
      </button>
    </span>
  );
}
