const IST = "Asia/Kolkata";

function parts(d: Date, opts: Intl.DateTimeFormatOptions) {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-GB", { timeZone: IST, hour12: false, ...opts }).formatToParts(d)) {
    out[p.type] = p.value;
  }
  return out;
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  return isNaN(d.getTime()) ? null : d;
}

/** "02/10/2026 16:15" in Indian Standard Time, whatever timezone the server or browser is in. */
export function formatIST(value: Date | string | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  const p = parts(d, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return `${p.day}/${p.month}/${p.year} ${p.hour === "24" ? "00" : p.hour}:${p.minute}`;
}

/** "02 Oct 2026, 4:15 pm" in IST. */
export function formatISTLong(value: Date | string | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/** "2026-10-02 16:15:07" in IST, for CSV exports. */
export function formatISTSql(value: Date | string | null | undefined): string {
  const d = toDate(value);
  if (!d) return "";
  const p = parts(d, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return `${p.year}-${p.month}-${p.day} ${p.hour === "24" ? "00" : p.hour}:${p.minute}:${p.second}`;
}
