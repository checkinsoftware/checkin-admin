import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { deviceLabel } from "@/lib/activity";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { hasDatabase, query } from "@/lib/db";
import { guestInfo } from "@/lib/sms";
import { formatIST, formatISTLong } from "@/lib/time";
import DeleteWebUserButton from "@/components/DeleteWebUserButton";
import GuestPasswordButton from "@/components/GuestPasswordButton";
import WebUserForm from "@/components/WebUserForm";
import { SetupNotice, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Web User · Checkin Admin" };

type Activity = { event: string; method: string | null; ip: string | null; user_agent: string | null; created_at: Date };
type Sms = { id: string; message: string; status: string; created_at: Date };

const EVENT_STYLE: Record<string, string> = {
  login: "bg-emerald-50 text-emerald-700",
  logout: "bg-slate-100 text-slate-600",
  created: "bg-indigo-50 text-indigo-700",
};
const METHOD_LABEL: Record<string, string> = {
  otp: "OTP",
  password: "Password",
  magic_link: "Magic link",
  admin: "Admin",
};

export default async function WebUserPage({ params }: { params: Promise<{ mobile: string }> }) {
  const store = await cookies();
  const session = await verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (session?.tag) redirect("/mng-x7k9/sms"); // hotel logins can't see web users

  const { mobile: raw } = await params;
  const mobile = decodeURIComponent(raw);

  if (!hasDatabase()) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-semibold tracking-tight">Web User</h1>
        <SetupNotice reason="no-url" />
      </div>
    );
  }

  type UserRow = {
    mobile: string;
    title: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    dob: string | null;
    organization: string | null;
    last_login_at: Date | null;
    has_password: boolean;
  };
  let user: UserRow | undefined;
  try {
    const cols = (org: string) =>
      `SELECT mobile, title, first_name, last_name, email, dob, ${org} AS organization, last_login_at,
              (password_hash IS NOT NULL) AS has_password
       FROM app_users WHERE mobile = $1`;
    try {
      [user] = await query<UserRow>(cols("organization"), [mobile]);
    } catch (err) {
      if ((err as { code?: string }).code !== "42703") throw err;
      [user] = await query<UserRow>(cols("NULL::text"), [mobile]);
    }
  } catch {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-semibold tracking-tight">Web User</h1>
        <SetupNotice reason="no-table" />
      </div>
    );
  }
  if (!user) notFound();

  let activity: Activity[] = [];
  let sms: Sms[] = [];
  let smsTotal = 0;
  let counts = { logins: 0, logouts: 0 };
  try {
    activity = await query<Activity>(
      `SELECT event, method, ip, user_agent, created_at FROM user_activity
       WHERE mobile = $1 ORDER BY created_at DESC LIMIT 200`,
      [mobile]
    );
    const c = await query<{ logins: number; logouts: number }>(
      `SELECT COUNT(*) FILTER (WHERE event = 'login')::int AS logins,
              COUNT(*) FILTER (WHERE event = 'logout')::int AS logouts
       FROM user_activity WHERE mobile = $1`,
      [mobile]
    );
    counts = c[0] ?? counts;
  } catch {
    /* user_activity not migrated yet: show an empty log */
  }
  try {
    sms = await query<Sms>(
      `SELECT id::text, message, status, created_at FROM sms_messages
       WHERE recipient = $1 ORDER BY created_at DESC LIMIT 200`,
      [mobile]
    );
    const t = await query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM sms_messages WHERE recipient = $1`, [mobile]);
    smsTotal = t[0]?.c ?? 0;
  } catch {
    /* sms table missing: leave empty */
  }

  const info = (await guestInfo([mobile]).catch(() => ({})) as Awaited<ReturnType<typeof guestInfo>>)[mobile];
  const fullName = [user.title, user.first_name, user.last_name].filter(Boolean).join(" ");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/mng-x7k9/webusers" className="text-sm font-medium text-indigo-600 hover:underline">
          ← Web Users
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">{fullName || mobile}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {fullName ? `${mobile} · ` : ""}
          {user.organization || "No organization set"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Tile label="Logins" value={counts.logins} />
        <Tile label="Logouts" value={counts.logouts} />
        <Tile label="Last login (IST)" value={formatIST(user.last_login_at)} small />
        <Tile label="Joined" value={info ? formatISTLong(info.joined) : "—"} small />
        <Tile
          label="Push notifications"
          value={info && info.devices > 0 ? `ON · ${info.devices} device${info.devices > 1 ? "s" : ""}` : "OFF"}
          hint={info?.installed ? "Installed app" : undefined}
          small
        />
      </div>

      <WebUserForm
        mode="edit"
        initial={{
          mobile,
          title: user.title ?? "",
          firstName: user.first_name ?? "",
          lastName: user.last_name ?? "",
          email: user.email ?? "",
          dob: user.dob ?? "",
          organization: user.organization ?? "",
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <span className="flex items-center gap-3">
          Password: <GuestPasswordButton mobile={mobile} hasPassword={user.has_password} />
        </span>
        <DeleteWebUserButton mobile={mobile} />
      </div>

      {/* Activity log */}
      <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <p className="border-b border-slate-200 px-4 py-3 text-sm font-semibold">
          Activity log <span className="font-normal text-slate-400">(latest {activity.length})</span>
        </p>
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">When (IST)</th>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Via</th>
              <th className="px-4 py-3">Device</th>
              <th className="px-4 py-3">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {activity.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  No activity recorded yet. Logins and logouts from now on will appear here.
                </td>
              </tr>
            ) : (
              activity.map((a, i) => (
                <tr key={i}>
                  <td className="px-4 py-2.5 text-slate-700">{formatIST(a.created_at)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold capitalize ${EVENT_STYLE[a.event] ?? "bg-slate-100 text-slate-600"}`}>
                      {a.event}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{a.method ? METHOD_LABEL[a.method] ?? a.method : "—"}</td>
                  <td className="px-4 py-2.5 text-slate-500">{deviceLabel(a.user_agent)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{a.ip || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {/* SMS for this number, short form */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <p className="text-sm font-semibold">
            SMS to this number{" "}
            <span className="font-normal text-slate-400">
              ({smsTotal.toLocaleString("en-IN")} total{smsTotal > sms.length ? `, latest ${sms.length}` : ""})
            </span>
          </p>
          <Link
            href={`/mng-x7k9/sms?number=${encodeURIComponent(mobile)}`}
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
          >
            Open in SMS list →
          </Link>
        </div>
        <ul className="divide-y divide-slate-100">
          {sms.length === 0 && <li className="px-4 py-6 text-sm text-slate-500">No SMS sent to this number yet.</li>}
          {sms.map((m) => (
            <li key={m.id} className="flex items-start gap-3 px-4 py-2.5">
              <span className="w-[130px] shrink-0 font-mono text-xs text-slate-500">{formatIST(m.created_at)}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-slate-700" title={m.message}>
                {m.message}
              </span>
              <StatusBadge status={m.status} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Tile({ label, value, hint, small }: { label: string; value: string | number; hint?: string; small?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 font-semibold ${small ? "text-sm leading-6" : "text-2xl"}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
