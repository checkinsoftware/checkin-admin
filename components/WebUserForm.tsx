"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type WebUserProfile = {
  mobile: string;
  title: string;
  firstName: string;
  lastName: string;
  email: string;
  dob: string;
  organization: string;
};

const EMPTY: WebUserProfile = { mobile: "", title: "", firstName: "", lastName: "", email: "", dob: "", organization: "" };
const TITLES = ["", "Mr.", "Mrs.", "Ms.", "Dr."];

const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none";
const label = "mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500";

/**
 * The same fields a guest sees in Edit Profile, plus a password, so an admin can
 * create a hotel owner's account (or fix one) and hand over mobile + password.
 */
export default function WebUserForm({ initial, mode }: { initial?: WebUserProfile; mode: "create" | "edit" }) {
  const router = useRouter();
  const [open, setOpen] = useState(mode === "edit");
  const [f, setF] = useState<WebUserProfile>(initial ?? EMPTY);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const set = (k: keyof WebUserProfile) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setOk("");
    try {
      const res = await fetch("/api/admin/webusers", {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || "Could not save.");
        return;
      }
      setPassword("");
      if (mode === "create") {
        setOk(
          data.hasPassword
            ? `Account created. ${data.mobile} can log in with this mobile and the password you set.`
            : `Account created for ${data.mobile}. No password set, so they log in with OTP.`
        );
        setF(EMPTY);
      } else {
        setOk(data.passwordChanged ? "Saved. Password changed." : "Saved.");
      }
      router.refresh();
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "create" && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
      >
        + Add web user
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">{mode === "create" ? "Add web user" : "Profile"}</p>
        {mode === "create" && (
          <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500 hover:underline">
            Close
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={label} htmlFor="wu-mobile">Mobile</label>
          <input
            id="wu-mobile"
            className={input}
            inputMode="numeric"
            placeholder="10-digit mobile"
            value={f.mobile}
            onChange={set("mobile")}
            disabled={mode === "edit"}
            required
          />
        </div>
        <div>
          <label className={label} htmlFor="wu-title">Title</label>
          <select id="wu-title" className={input} value={f.title} onChange={set("title")}>
            {TITLES.map((t) => (
              <option key={t} value={t}>{t || "—"}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="wu-first">First name</label>
          <input id="wu-first" className={input} value={f.firstName} onChange={set("firstName")} />
        </div>
        <div>
          <label className={label} htmlFor="wu-last">Last name</label>
          <input id="wu-last" className={input} value={f.lastName} onChange={set("lastName")} />
        </div>
        <div>
          <label className={label} htmlFor="wu-email">Email</label>
          <input id="wu-email" className={input} type="email" value={f.email} onChange={set("email")} />
        </div>
        <div>
          <label className={label} htmlFor="wu-org">Organization / hotel</label>
          <input id="wu-org" className={input} maxLength={100} placeholder="Optional" value={f.organization} onChange={set("organization")} />
        </div>
        <div>
          <label className={label} htmlFor="wu-dob">Date of birth</label>
          <input id="wu-dob" className={input} type="date" value={f.dob} onChange={set("dob")} />
        </div>
        <div>
          <label className={label} htmlFor="wu-pass">
            {mode === "create" ? "Password (optional)" : "New password (blank = keep)"}
          </label>
          <input
            id="wu-pass"
            className={input}
            type="text"
            autoComplete="off"
            placeholder="min 4 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      </div>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      {ok && <p className="mt-3 text-sm text-emerald-700">{ok}</p>}

      <div className="mt-4">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {busy ? "Saving…" : mode === "create" ? "Create account" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
