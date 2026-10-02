import { hasDatabase, query } from "./db";
import { STATUSES, type SmsStatus } from "./sms-status";

export { STATUSES };
export type { SmsStatus };

export type SmsRow = {
  id: string;
  recipient: string;
  guest_name: string | null;
  message: string;
  status: SmsStatus;
  provider: string | null;
  template: string | null;
  segments: number;
  cost: string;
  error: string | null;
  source_ip: string | null;
  created_at: Date;
  sent_at: Date | null;
};

export type SmsFilters = {
  q?: string;
  status?: string;
  number?: string;
  tag?: string; // hotel tag: message must contain this text (e.g. "@Arco Team")
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
};

export type SmsStats = {
  total: number;
  delivered: number;
  failed: number;
  pending: number;
  cost: number;
};

export type SmsListResult = {
  rows: SmsRow[];
  total: number;
  pages: number;
  stats: SmsStats;
};

export class DbNotReady extends Error {
  constructor(public reason: "no-url" | "no-table", message: string) {
    super(message);
  }
}

function buildWhere(f: SmsFilters) {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (f.q) {
    params.push(`%${f.q}%`);
    const i = params.length;
    clauses.push(
      `(recipient ILIKE $${i} OR COALESCE(guest_name,'') ILIKE $${i} OR message ILIKE $${i})`
    );
  }
  if (f.status === "pending") {
    // "Pending" = handed to the gateway but no delivery report yet.
    clauses.push(`status IN ('queued','sent')`);
  } else if (f.status && STATUSES.includes(f.status as SmsStatus)) {
    params.push(f.status);
    clauses.push(`status = $${params.length}`);
  }
  if (f.number) {
    params.push(f.number);
    clauses.push(`recipient = $${params.length}`);
  }
  if (f.tag) {
    params.push(`%${f.tag}%`);
    clauses.push(`message ILIKE $${params.length}`);
  }
  // IST calendar days, not the DB's own (UTC) day -- see app/api/user/messages
  // for why the plain ::date comparison silently misses the early-morning window.
  if (f.from) {
    params.push(f.from);
    clauses.push(`created_at >= ($${params.length}::date::timestamp AT TIME ZONE 'Asia/Kolkata')`);
  }
  if (f.to) {
    params.push(f.to);
    clauses.push(`created_at < (($${params.length}::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Asia/Kolkata')`);
  }

  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

function assertDb() {
  if (!hasDatabase()) {
    throw new DbNotReady("no-url", "DATABASE_URL is not configured.");
  }
}

function rethrow(err: unknown): never {
  if (typeof err === "object" && err && (err as { code?: string }).code === "42P01") {
    throw new DbNotReady("no-table", "Table sms_messages does not exist yet.");
  }
  throw err;
}

export async function listSms(f: SmsFilters): Promise<SmsListResult> {
  assertDb();
  const { where, params } = buildWhere(f);
  // The Delivered / Pending / Failed counters act as status filters, so they
  // must keep counting across statuses while one of them is selected.
  const { where: statsWhere, params: statsParams } = buildWhere({ ...f, status: undefined });
  const offset = (f.page - 1) * f.pageSize;

  try {
    const [rows, agg, filtered] = await Promise.all([
      query<SmsRow>(
        `SELECT id::text, recipient, guest_name, message, status, provider, template,
                segments, cost::text, error, source_ip, created_at, sent_at
         FROM sms_messages ${where}
         ORDER BY created_at DESC, id DESC
         LIMIT ${f.pageSize} OFFSET ${offset}`,
        params
      ),
      query<Record<string, string>>(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered,
                COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
                COUNT(*) FILTER (WHERE status IN ('queued','sent'))::int AS pending,
                COALESCE(SUM(cost),0)::float8 AS cost
         FROM sms_messages ${statsWhere}`,
        statsParams
      ),
      f.status
        ? query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM sms_messages ${where}`, params)
        : Promise.resolve(null),
    ]);

    const s = agg[0] as unknown as SmsStats;
    const total = filtered ? filtered[0].c : s.total;
    return {
      rows,
      total,
      pages: Math.max(1, Math.ceil(total / f.pageSize)),
      stats: s,
    };
  } catch (err) {
    rethrow(err);
  }
}

export async function allSmsForExport(f: SmsFilters): Promise<SmsRow[]> {
  assertDb();
  const { where, params } = buildWhere(f);
  try {
    return await query<SmsRow>(
      `SELECT id::text, recipient, guest_name, message, status, provider, template,
              segments, cost::text, error, source_ip, created_at, sent_at
       FROM sms_messages ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT 10000`,
      params
    );
  } catch (err) {
    rethrow(err);
  }
}

export function parseFilters(sp: Record<string, string | string[] | undefined>): SmsFilters {
  const one = (k: string) => {
    const v = sp[k];
    const s = Array.isArray(v) ? v[0] : v;
    return s && s.trim() ? s.trim() : undefined;
  };
  const page = Math.max(1, Number(one("page") ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(one("size") ?? 25) || 25));
  const date = (k: string) => {
    const v = one(k);
    return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
  };
  return {
    q: one("q"),
    status: one("status"),
    number: one("number"),
    tag: one("tag"),
    from: date("from"),
    to: date("to"),
    page,
    pageSize,
  };
}

export type GuestInfo = {
  /** When this number first logged in on the site. */
  joined: Date;
  /** Number of devices registered for push on this number. */
  devices: number;
  /** A device on this number was registered from the installed app, not a browser tab. */
  installed: boolean;
  name: string | null;
  email: string | null;
  /** Hotel / company the number belongs to (free text, may repeat). */
  organization: string | null;
};

/** Account, profile and push status for a set of numbers; numbers that never logged in are absent. */
export async function guestInfo(mobiles: string[]): Promise<Record<string, GuestInfo>> {
  const list = Array.from(new Set(mobiles.filter(Boolean)));
  if (!list.length) return {};
  type Row = GuestInfo & { mobile: string };
  const full = `SELECT u.mobile, u.created_at AS joined, u.name, u.email, u.organization,
           COALESCE(d.n, 0)::int AS devices, COALESCE(d.inst, FALSE) AS installed
    FROM app_users u
    LEFT JOIN (
      SELECT mobile, COUNT(*) AS n, bool_or(installed) AS inst
      FROM device_tokens WHERE mobile = ANY($1) GROUP BY mobile
    ) d ON d.mobile = u.mobile
    WHERE u.mobile = ANY($1)`;
  // Same shape before the installed/organization columns are migrated.
  const basic = `SELECT u.mobile, u.created_at AS joined, u.name, u.email, NULL::text AS organization,
           COALESCE(d.n, 0)::int AS devices, FALSE AS installed
    FROM app_users u
    LEFT JOIN (
      SELECT mobile, COUNT(*) AS n FROM device_tokens WHERE mobile = ANY($1) GROUP BY mobile
    ) d ON d.mobile = u.mobile
    WHERE u.mobile = ANY($1)`;
  let rows: Row[];
  try {
    rows = await query<Row>(full, [list]);
  } catch (err) {
    if ((err as { code?: string }).code !== "42703") throw err;
    rows = await query<Row>(basic, [list]);
  }
  return Object.fromEntries(rows.map(({ mobile, ...info }) => [mobile, info]));
}

/** Distinct hotel tags actually present in messages (best-effort, for super-admin filter). */
export async function hotelTagsFromUsers(): Promise<string[]> {
  assertDb();
  try {
    const rows = await query<{ sms_tag: string }>(
      "SELECT DISTINCT sms_tag FROM admin_users WHERE sms_tag IS NOT NULL AND sms_tag <> '' ORDER BY sms_tag ASC"
    );
    return rows.map((r) => r.sms_tag);
  } catch {
    return [];
  }
}

/** Distinct recipient numbers (for the filter dropdown), most-used first. */
export async function distinctNumbers(): Promise<{ recipient: string; guest_name: string | null; c: number }[]> {
  assertDb();
  try {
    return await query<{ recipient: string; guest_name: string | null; c: number }>(
      `SELECT recipient,
              MAX(guest_name) AS guest_name,
              COUNT(*)::int AS c
       FROM sms_messages
       GROUP BY recipient
       ORDER BY c DESC, recipient ASC
       LIMIT 300`
    );
  } catch (err) {
    rethrow(err);
  }
}

/** Delete every message matching the given filters. Returns how many were removed. */
export async function deleteSmsRange(f: SmsFilters): Promise<number> {
  assertDb();
  const { where, params } = buildWhere(f);
  if (!where) return 0; // never allow an unfiltered delete-all here
  try {
    const rows = await query<{ id: string }>(
      `DELETE FROM sms_messages ${where} RETURNING id::text`,
      params
    );
    return rows.length;
  } catch (err) {
    rethrow(err);
  }
}
