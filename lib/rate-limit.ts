import { query } from "./db";

/** Caller's IP as Netlify / proxies report it. */
export function clientIp(req: Request): string {
  return (
    req.headers.get("x-nf-client-connection-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/**
 * Counts one hit against `key` in a fixed window and returns true once it has been
 * hit more than `max` times in that window. The counter lives in Postgres so it is
 * shared by every serverless instance (an in-memory Map is per-instance and useless
 * here). If the table or database is unavailable it fails open: a broken limiter
 * must not lock every guest out.
 */
export async function tooMany(key: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const rows = await query<{ count: number }>(
      `INSERT INTO rate_limits (key, count, reset_at)
       VALUES ($1, 1, NOW() + ($2 || ' seconds')::interval)
       ON CONFLICT (key) DO UPDATE SET
         count    = CASE WHEN rate_limits.reset_at < NOW() THEN 1 ELSE rate_limits.count + 1 END,
         reset_at = CASE WHEN rate_limits.reset_at < NOW() THEN NOW() + ($2 || ' seconds')::interval ELSE rate_limits.reset_at END
       RETURNING count`,
      [key, String(windowSeconds)]
    );
    return (rows[0]?.count ?? 0) > max;
  } catch {
    return false;
  }
}

/** Housekeeping: drop expired counters. Cheap, called opportunistically. */
export async function sweepRateLimits() {
  try {
    await query(`DELETE FROM rate_limits WHERE reset_at < NOW() - INTERVAL '1 day'`);
  } catch {
    /* ignore */
  }
}
