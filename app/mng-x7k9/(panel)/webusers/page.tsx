import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { hasDatabase, query } from "@/lib/db";
import { SetupNotice } from "@/components/ui";
import Link from "next/link";
import GuestPasswordButton from "@/components/GuestPasswordButton";
import WebUserForm from "@/components/WebUserForm";
import { formatIST } from "@/lib/time";

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
  organization: string | null;
  created_at: Date;
  last_login_at: Date | null;
  has_password: boolean;
  logins: number;
  logouts: number;
};

function fmt(v: Date | string | null) {
  if (!v) return "—";
  const d = typeof v === "string" ? new Date(v) : v;
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
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
    const base = (org: string, activity: string) => `SELECT u.mobile, u.name, u.email, u.dob, ${org} AS organization,
              u.created_at, u.last_login_at, (u.password_hash IS NOT NULL) AS has_password,
              ${activity}
       FROM app_users u
       ORDER BY u.last_login_at DESC NULLS LAST, u.created_at DESC LIMIT 300`;
    const counts = `COALESCE((SELECT COUNT(*) FROM user_activity a WHERE a.mobile = u.mobile AND a.event = 'login'), 0)::int AS logins,
              COALESCE((SELECT COUNT(*) FROM user_activity a WHERE a.mobile = u.mobile AND a.event = 'logout'), 0)::int AS logouts`;
    try {
      users = await query<UserRow>(base("u.organization", counts));
    } catch (err) {
      // organization / user_activity not migrated yet: still list the users.
      if ((err as { code?: string }).code !== "42703" && (err as { code?: string }).code !== "42P01") throw err;
      users = await query<UserRow>(base("NULL::text", "0 AS logins, 0 AS logouts"));
    }
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

  const byMobile = new Map(users.map((u) => [u.mobile, u]));
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

      <WebUserForm mode="create" />

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
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {r.mobile}
                      {(() => {
                        const u = byMobile.get(r.mobile);
                        const line = [u?.name, u?.organization].filter(Boolean).join(" · ");
                        return line ? <div className="text-xs font-normal text-slate-500">{line}</div> : null;
                      })()}
                    </td>
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
        <table className="w-full min-w-[1150px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Mobile</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Organization</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">DOB</th>
              <th className="px-4 py-3">Logins / logouts</th>
              <th className="px-4 py-3">Last login (IST)</th>
              <th className="px-4 py-3">Password</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-slate-400">
                  Abhi koi web user nahi.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.mobile}>
                  <td className="px-4 py-3 font-medium text-slate-800">{u.mobile}</td>
                  <td className="px-4 py-3 text-slate-700">{u.name || "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{u.organization || "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{u.email || "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{u.dob || "—"}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {u.logins} / {u.logouts}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatIST(u.last_login_at)}</td>
                  <td className="px-4 py-3">
                    <GuestPasswordButton mobile={u.mobile} hasPassword={u.has_password} />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/mng-x7k9/webusers/${encodeURIComponent(u.mobile)}`}
                      className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                    >
                      Activity
                    </Link>
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
