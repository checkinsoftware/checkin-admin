"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Step = "mobile" | "otp";

// Bottom-sheet login (mobile -> OTP). Styled like a modern app login prompt:
// gradient promo banner, "IN +91" prefix, dark "Send OTP" button, Skip for now.
// While no SMS gateway is wired (OTP_SKIP) the code is shown on screen.
export default function GuestLoginSheet() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("mobile");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

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
      router.refresh();
    } catch {
      setError("Network error.");
      setBusy(false);
    }
  }

  // Skipped -> small floating "Login" bar to bring the sheet back.
  if (dismissed) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-4">
        <button
          onClick={() => setDismissed(false)}
          className="w-full max-w-md rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white shadow-xl"
        >
          Login to see your messages
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-slate-900/50" onClick={() => setDismissed(true)} />
      <div className="relative w-full max-w-md rounded-t-3xl bg-white p-4 pb-6 shadow-2xl sm:rounded-3xl">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200 sm:hidden" />

        {/* gradient promo banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 p-3 pr-9 text-white">
          <button
            onClick={() => setDismissed(true)}
            aria-label="Close"
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-sm"
          >
            ✕
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full bg-amber-400 text-[11px] font-bold leading-tight text-amber-900">
              <span className="text-sm">🔔</span>
            </div>
            <div>
              <p className="text-sm font-bold">Login Now</p>
              <p className="text-xs text-white/90">
                Login karke apne hotel ke messages &amp; alerts turant paayein ✨
              </p>
            </div>
          </div>
        </div>

        {/* body */}
        <div className="px-1 pt-4">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Login with Mobile</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            We&apos;ll send an OTP to verify your number.
          </p>

          {step === "mobile" ? (
            <form onSubmit={sendOtp} className="mt-4 space-y-3">
              <div className="flex items-stretch gap-2">
                <span className="flex items-center gap-1 rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
                  🇮🇳 +91
                </span>
                <input
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="Enter mobile number"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
                  autoFocus
                  required
                />
              </div>
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-slate-900 px-3 py-3.5 text-base font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {busy ? "Sending…" : "Send OTP →"}
              </button>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="w-full py-1 text-center text-sm font-medium text-slate-400 hover:text-slate-600"
              >
                Skip for now
              </button>
            </form>
          ) : (
            <form onSubmit={verify} className="mt-4 space-y-3">
              <p className="text-sm text-slate-600">
                Code sent to <strong>+91 {mobile}</strong>.{" "}
                <button
                  type="button"
                  onClick={() => {
                    setStep("mobile");
                    setCode("");
                    setError(null);
                  }}
                  className="font-medium text-indigo-600 underline"
                >
                  Change
                </button>
              </p>
              <input
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-lg tracking-[0.5em] outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                inputMode="numeric"
                maxLength={6}
                placeholder="••••••"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                autoFocus
              />
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-slate-900 px-3 py-3.5 text-base font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {busy ? "Verifying…" : "Verify & continue"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
