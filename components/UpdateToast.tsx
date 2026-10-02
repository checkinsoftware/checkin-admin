"use client";

import { useEffect, useState } from "react";

const KEY = "ck_build_seen_admin";

/**
 * First load after a new deploy: flash when that build was made, for 5 seconds,
 * so it's obvious the update has gone live. (The public site does the same in guest-widget.js.)
 */
export default function UpdateToast() {
  const [label, setLabel] = useState("");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    fetch("/build-info.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((info: { builtAt?: string } | null) => {
        if (cancelled || !info?.builtAt) return;
        let seen: string | null = null;
        try {
          seen = localStorage.getItem(KEY);
        } catch {
          /* storage blocked: show it every load */
        }
        if (seen === info.builtAt) return;
        try {
          localStorage.setItem(KEY, info.builtAt);
        } catch {
          /* ignore */
        }
        setLabel(
          new Date(info.builtAt).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })
        );
        timer = setTimeout(() => setLabel(""), 5000);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!label) return null;
  return (
    <div
      role="status"
      className="fixed left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg"
    >
      <span className="h-2 w-2 rounded-full bg-emerald-400" />
      <span>
        <strong className="font-semibold">Updated</strong> · {label} IST
      </span>
    </div>
  );
}
