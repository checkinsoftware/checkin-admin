import { NextResponse } from "next/server";
import { hasDatabase, query } from "./db";
import { pushToMobile } from "./fcm";
import { STATUSES } from "./sms-status";

/** Vendor-facing response shape: code 0 = success, code 1 = failure. */
function ok(data: Record<string, unknown>) {
  return NextResponse.json({ code: 0, error: false, message: "SMS inserted successfully", ...data });
}

function fail(message: string, status = 400) {
  return NextResponse.json({ code: 1, error: true, message }, { status });
}

const MOBILE_KEYS = ["mobileNo", "mobile_no", "mobile", "phone_number"];
const TEXT_KEYS = ["smsText", "sms_text", "message", "text"];

function pick(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

/**
 * Accepts 10-digit Indian numbers, 91-prefixed, or +91-prefixed.
 * Returns the number normalised to +91XXXXXXXXXX, or null if it isn't usable.
 */
export function normaliseMobile(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  if (/^0[6-9]\d{9}$/.test(digits)) return `+91${digits.slice(1)}`;
  // Any other international number: keep as-is if it looks like a phone number.
  if (/^\d{8,15}$/.test(digits)) return `+${digits}`;
  return null;
}

// Light abuse guard for an endpoint that is intentionally open.
const hits = new Map<string, { count: number; until: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;

function rateLimited(ip: string) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.until < now) {
    hits.set(ip, { count: 1, until: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

async function readParams(req: Request): Promise<Record<string, unknown>> {
  const params: Record<string, unknown> = {};
  for (const [key, value] of new URL(req.url).searchParams.entries()) params[key] = value;

  if (req.method === "POST") {
    const type = req.headers.get("content-type") ?? "";
    if (type.includes("application/json")) {
      try {
        const body = await req.json();
        if (body && typeof body === "object") Object.assign(params, body);
      } catch {
        // Fall through — query-string values may still carry the fields.
      }
    } else {
      try {
        const form = await req.formData();
        for (const [key, value] of form.entries()) {
          if (typeof value === "string") params[key] = value;
        }
      } catch {
        // Some clients send a raw urlencoded body without the header.
        try {
          const text = await req.text();
          for (const [key, value] of new URLSearchParams(text).entries()) params[key] = value;
        } catch {
          /* ignore */
        }
      }
    }
  }
  return params;
}

export async function handleSmsInsert(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) return fail("Too many requests. Try again in a minute.", 429);

  const params = await readParams(req);

  const rawMobile = pick(params, MOBILE_KEYS);
  if (!rawMobile) return fail("mobileNo is required");

  const mobile = normaliseMobile(rawMobile);
  if (!mobile) return fail("mobileNo is not a valid mobile number");

  const text = pick(params, TEXT_KEYS);
  if (!text) return fail("smsText is required");

  if (!hasDatabase()) return fail("Database is not configured.", 503);

  const statusRaw = (pick(params, ["status"]) ?? "sent").toLowerCase();
  const status = STATUSES.includes(statusRaw as never) ? statusRaw : "sent";
  const guestName = pick(params, ["guest_name", "guestName", "name"]);
  const provider = pick(params, ["provider"]) ?? "api";
  const template = pick(params, ["template"]);

  try {
    const rows = await query<{ id: string }>(
      `INSERT INTO sms_messages
         (recipient, guest_name, message, status, provider, template, segments, cost, source_ip, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, NOW())
       RETURNING id::text`,
      [
        mobile,
        guestName,
        text.slice(0, 2000),
        status,
        provider,
        template,
        Math.min(10, Math.ceil(text.length / 160) || 1),
        ip === "local" ? null : ip,
      ]
    );
    // Notify every device this guest has registered. Push failures are logged
    // to notification_log but never fail the insert — the vendor only cares
    // that the message was stored.
    const push = await pushToMobile(
      mobile,
      "CHECKIN",
      text.length > 120 ? `${text.slice(0, 117)}…` : text,
      { smsId: rows[0].id, mobile }
    );

    return ok({ id: rows[0].id, mobileNo: mobile, status, push });
  } catch (err) {
    if (typeof err === "object" && err && (err as { code?: string }).code === "42P01") {
      return fail("Table sms_messages does not exist. Run the database setup first.", 503);
    }
    return fail("Could not insert SMS.", 500);
  }
}
