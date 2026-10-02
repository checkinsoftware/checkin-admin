import type { SmsStatus } from "@/lib/sms-status";
import DbSetupButton from "./DbSetupButton";

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "good" | "bad" | "warn";
}) {
  const tones: Record<string, string> = {
    default: "text-slate-900",
    good: "text-emerald-600",
    bad: "text-red-600",
    warn: "text-amber-600",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tones[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function StatusBadge({ status }: { status: SmsStatus | string }) {
  const styles: Record<string, string> = {
    delivered: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    sent: "bg-sky-50 text-sky-700 ring-sky-200",
    queued: "bg-amber-50 text-amber-700 ring-amber-200",
    failed: "bg-red-50 text-red-700 ring-red-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ${
        styles[status] ?? "bg-slate-50 text-slate-600 ring-slate-200"
      }`}
    >
      {status}
    </span>
  );
}

export function SetupNotice({ reason }: { reason: "no-url" | "no-table" }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
      <p className="font-semibold">
        {reason === "no-url" ? "Database not connected yet" : "Database table missing"}
      </p>
      {reason === "no-url" ? (
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            Create a Postgres database (Vercel &rarr; Storage &rarr; Neon, or neon.tech).
          </li>
          <li>
            Add its connection string as the <code>DATABASE_URL</code> environment variable.
          </li>
          <li>
            Run <code>npm run db:setup -- --seed</code> once to create the table.
          </li>
        </ol>
      ) : (
        <>
          <p className="mt-2">
            The <code>sms_messages</code> table has not been created yet. Run the setup below, or
            run <code>npm run db:setup -- --seed</code> locally.
          </p>
          <DbSetupButton />
        </>
      )}
    </div>
  );
}

export function formatDate(value: Date | string | null) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
