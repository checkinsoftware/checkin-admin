"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Step = "mobile" | "otp";

export default function UserLoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("mobile");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const field =
    "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/user/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error || "Could not send the code.");
      else {
        setStep("otp");
      }
    } catch {
      setError("Network error.");
    }
    setBusy(false);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/user/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not verify.");
        setBusy(false);
        return;
      }
      router.replace("/user");
      router.refresh();
    } catch {
      setError("Network error.");
      setBusy(false);
    }
  }

  if (step === "mobile") {
    return (
      <form onSubmit={sendOtp} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Mobile number</label>
          <input
            className={field}
            type="tel"
            inputMode="numeric"
            placeholder="98765 43210"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            autoFocus
            required
          />
          <p className="mt-1 text-xs text-slate-500">
            10-digit number, or with +91 — both work.
          </p>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-indigo-600 px-3 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {busy ? "Sending…" : "Send OTP"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      <p className="text-sm text-slate-600">
        Code sent to <strong>{mobile}</strong>.{" "}
        <button
          type="button"
          onClick={() => {
            setStep("mobile");
            setCode("");
            setError(null);
          }}
          className="text-indigo-600 underline"
        >
          Change
        </button>
      </p>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">6-digit code</label>
        <input
          className={`${field} tracking-[0.4em]`}
          inputMode="numeric"
          maxLength={6}
          placeholder="••••••"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          autoFocus
        />
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-indigo-600 px-3 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
      >
        {busy ? "Verifying…" : "Verify & continue"}
      </button>
    </form>
  );
}
