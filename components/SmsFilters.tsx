"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type NumberOpt = { recipient: string; guest_name: string | null; c: number };

export default function SmsFilters({
  numbers = [],
  hotels = [],
  canDelete = true,
}: {
  numbers?: NumberOpt[];
  hotels?: string[];
  canDelete?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const [q, setQ] = useState(params.get("q") ?? "");
  const [number, setNumber] = useState(params.get("number") ?? "");
  const [tag, setTag] = useState(params.get("tag") ?? "");
  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState(params.get("to") ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setQ(params.get("q") ?? "");
    setNumber(params.get("number") ?? "");
    setTag(params.get("tag") ?? "");
    setFrom(params.get("from") ?? "");
    setTo(params.get("to") ?? "");
  }, [params]);

  function apply(e?: React.FormEvent) {
    e?.preventDefault();
    const next = new URLSearchParams();
    if (from) next.set("from", from);
    if (to) next.set("to", to);
    if (tag) next.set("tag", tag);
    if (number) next.set("number", number);
    if (q.trim()) next.set("q", q.trim());
    const size = params.get("size");
    if (size) next.set("size", size);
    const status = params.get("status");
    if (status) next.set("status", status);
    router.push(`/mng-x7k9/sms${next.toString() ? `?${next}` : ""}`);
  }

  function clearAll() {
    setMsg(null);
    router.push("/mng-x7k9/sms");
  }

  async function deleteRange() {
    setMsg(null);
    if (!from && !to && !number && !tag && !q.trim()) {
      setMsg("Pehle date range / hotel / number / search chuno, phir Delete Range.");
      return;
    }
    const what = [
      from || to ? `${from || "…"} → ${to || "…"}` : null,
      tag ? `hotel ${tag}` : null,
      number ? `number ${number}` : null,
      q.trim() ? `“${q.trim()}”` : null,
    ]
      .filter(Boolean)
      .join(", ");
    if (!confirm(`Delete all messages matching: ${what}?\nThis cannot be undone.`)) return;

    setBusy(true);
    try {
      const res = await fetch("/api/admin/delete-range", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, number, tag, q: q.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg(`Deleted ${data.deleted} message(s).`);
        router.refresh();
      } else {
        setMsg(data.error || "Delete failed.");
      }
    } catch {
      setMsg("Network error.");
    }
    setBusy(false);
  }

  return (
    <form className="filter-card" onSubmit={apply}>
      <div className="filter-row">
        <input type="date" title="From date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" title="To date" value={to} onChange={(e) => setTo(e.target.value)} />
        {hotels.length > 0 && (
          <select value={tag} onChange={(e) => setTag(e.target.value)} title="Filter by hotel">
            <option value="">All hotels</option>
            {hotels.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        )}
        <select value={number} onChange={(e) => setNumber(e.target.value)} title="Filter by number">
          <option value="">All numbers</option>
          {numbers.map((n) => (
            <option key={n.recipient} value={n.recipient}>
              {n.recipient}
              {n.guest_name ? ` — ${n.guest_name}` : ""} ({n.c})
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search mobile number, SMS text, or status"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="submit" className="btn btn-primary">
          Search now
        </button>
        <button type="button" className="btn btn-ghost" onClick={clearAll}>
          Clear
        </button>
        {canDelete && (
          <button
            type="button"
            className="btn btn-danger"
            onClick={deleteRange}
            disabled={busy}
            style={{ marginLeft: "auto" }}
          >
            {busy ? "Deleting…" : "Delete Range"}
          </button>
        )}
      </div>
      {msg && <div className="filter-msg">{msg}</div>}
    </form>
  );
}
