import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import NavLink from "@/components/NavLink";
import UpdateToast from "@/components/UpdateToast";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const session = await verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/mng-x7k9/login");
  const isHotel = !!session.tag; // hotel login: SMS-only, no admin tools

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar: logo + horizontal nav + signed-in / log out */}
      <header className="border-b border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5">
          <Link href="/mng-x7k9" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
              C
            </span>
            <span className="font-semibold tracking-tight">Checkin</span>
          </Link>

          <nav className="flex items-center gap-1 overflow-x-auto">
            {isHotel ? (
              <>
                <NavLink href="/mng-x7k9/sms" label="My Hotel SMS" icon="✉" />
                <NavLink href="/mng-x7k9/account" label="Change password" icon="⚿" />
              </>
            ) : (
              <>
                <NavLink href="/mng-x7k9" label="Dashboard" icon="▦" />
                <NavLink href="/mng-x7k9/sms" label="SMS List" icon="✉" />
                <NavLink href="/mng-x7k9/webusers" label="Web Users" icon="☏" />
                <NavLink href="/mng-x7k9/users" label="Users" icon="◫" />
                <NavLink href="/mng-x7k9/build-setup" label="BuildKhata" icon="▤" />
                <NavLink href="/mng-x7k9/account" label="Change password" icon="⚿" />
              </>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">
              Signed in as <strong className="text-slate-700">{session.username}</strong>
            </span>
            <form action="/api/auth/logout" method="post">
              <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <UpdateToast />

      {/* Full-width content */}
      <main className="flex-1 p-5">{children}</main>
    </div>
  );
}
