import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { hasDatabase, query } from "@/lib/db";
import { SetupNotice } from "@/components/ui";
import GuestPasswordButton from "@/components/GuestPasswordButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Web Users · Checkin Admin" };

type OtpRow = {
  mobile: string;
  code: string;
  created_at: Date;
  used_at: Date | null;
  expires_at: Date;
};
type UserRow = {
  mobile: string;
  name: string | null;
  email: string | null;
  dob: string | null;
  created_at: Date;
  last_login_at: Date | null;
  has_password: boolean;
};

function fmt(v: Date | string | null) {
  if (!v) return "—";
  const d = typeof v === "string" ? new Date(v) : v;
  return isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default async function WebUsersPage() {
  const store = await cookies();
  const session = await verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (session?.tag) redirect("/mng-x7k9/sms"); // hotel logins can't see web users

  if (!hasDatabase()) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-semibold tracking-tight">Web Users</h1>
        <SetupNotice reason="no-url" />
      </div>
    );
  }

  let otps: OtpRow[] = [];
  let users: UserRow[] = [];
  let needsSetup = false;
  try {
    otps = await query<OtpRow>(
      `SELECT mobile, code, created_at, used_at, expires_at
       FROM otp_codes ORDER BY created_at DESC LIMIT 100`
    );
    users = await query<UserRow>(
      `SELECT mobile, name, email, dob, created_at, last_login_at,
              (password_hash IS NOT NULL) AS has_password
       FROM app_users ORDER BY last_login_at DESC NULLS LAST, created_at DESC LIMIT 300`
    );
  } catch {
    needsSetup = true;
  }

  if (needsSetup) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-semibold tracking-tight">Web Users</h1>
        <SetupNotice reason="no-table" />
      </div>
    );
  }

  const now = Date.now();
  const otpState = (r: OtpRow) => {
    if (r.used_at) return { label: "used", cls: "bg-slate-100 text-slate-500" };
    if (new Date(r.expires_at).getTime() < now) return { label: "expired", cls: "bg-amber-100 text-amber-700" };
    return { label: "active", cls: "bg-green-100 text-green-700" };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Web Users</h1>
        <p className="mt-1 text-sm text-slate-500">
          Website (mobile) logins. <strong>DLT registration hone tak</strong> OTP yahan dikh raha
          hai — guest ko OTP batane ke liye use karein.
        </p>
      </div>

      {/* Recent OTPs */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <p className="border-b border-slate-200 px-4 py-3 text-sm font-semibold">Recent OTP codes</p>
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Mobile</th>
              <th className="px-4 py-3">OTP</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Sent at</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {otps.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  Abhi koi OTP nahi.
                </td>
              </tr>
            ) : (
              otps.map((r, i) => {
                const st = otpState(r);
                return (
                  <tr key={i}>
                    <td className="px-4 py-3 font-medium text-slate-800">{r.mobile}</td>
                    <td className="px-4 py-3 font-mono text-base font-semibold tracking-widest text-indigo-700">
                      {r.code}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{fmt(r.created_at)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* App users */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <p className="border-b border-slate-200 px-4 py-3 text-sm font-semibold">
          Logged-in numbers ({users.length})
        </p>
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Mobile</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">DOB</th>
              <th className="px-4 py-3">Last login</th>
              <th className="px-4 py-3">Password</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Abhi koi web user nahi.
                </td>
              </tr>
            ) : (
              users.map((u, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 font-medium text-slate-800">{u.mobile}</td>
                  <td className="px-4 py-3 text-slate-700">{u.name || "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{u.email || "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{u.dob || "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{fmt(u.last_login_at)}</td>
                  <td className="px-4 py-3">
                    <GuestPasswordButton mobile={u.mobile} hasPassword={u.has_password} />
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
