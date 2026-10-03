import { query } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";

// Admin users created inside the panel. The env ADMIN_USERNAME /
// ADMIN_PASSWORD_HASH login stays as a bootstrap / recovery account and is
// never stored here.

export type AdminUser = {
  id: string;
  username: string;
  sms_tag: string | null;
  created_at: string;
  last_login_at: string | null;
};

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,32}$/;

export function validUsername(u: unknown): u is string {
  return typeof u === "string" && USERNAME_RE.test(u.trim());
}

export function validPassword(p: unknown): p is string {
  return typeof p === "string" && p.length >= 6 && p.length <= 200;
}

// A hotel tag is the text to look for in the SMS (e.g. "Arco Team" or "@Arco Team"). Blank = full admin.
export function cleanTag(t: unknown): string | null {
  const s = typeof t === "string" ? t.trim() : "";
  return s ? s.slice(0, 60) : null;
}

// Validate a tag the user typed. Empty is allowed (full admin). A non-empty
// tag must be at least 4 characters (shorter ones would match almost every SMS);
// a leading "@" is optional. Returns an error message to show, or null when fine.
export function tagError(t: unknown): string | null {
  const s = typeof t === "string" ? t.trim() : "";
  if (!s) return null; // empty = full admin, OK
  if (s.length < 4) return "Hotel tag kam se kam 4 character ka hona chahiye (jaise Arco).";
  return null;
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  return query<AdminUser>(
    "SELECT id::text AS id, username, sms_tag, created_at, last_login_at FROM admin_users ORDER BY username ASC"
  );
}

export async function adminUserExists(username: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    "SELECT id FROM admin_users WHERE lower(username) = lower($1) LIMIT 1",
    [username.trim()]
  );
  return rows.length > 0;
}

export async function createAdminUser(
  username: string,
  password: string,
  tag?: string | null
): Promise<void> {
  const hash = await hashPassword(password);
  await query("INSERT INTO admin_users (username, password_hash, sms_tag) VALUES ($1, $2, $3)", [
    username.trim(),
    hash,
    cleanTag(tag ?? null),
  ]);
}

export async function setAdminUserTag(id: string, tag: string | null): Promise<boolean> {
  const rows = await query<{ id: string }>(
    "UPDATE admin_users SET sms_tag = $1 WHERE id = $2 RETURNING id",
    [cleanTag(tag), id]
  );
  return rows.length > 0;
}

export async function deleteAdminUser(id: string): Promise<void> {
  await query("DELETE FROM admin_users WHERE id = $1", [id]);
}

export async function setAdminUserPassword(id: string, password: string): Promise<boolean> {
  const hash = await hashPassword(password);
  const rows = await query<{ id: string }>(
    "UPDATE admin_users SET password_hash = $1 WHERE id = $2 RETURNING id",
    [hash, id]
  );
  return rows.length > 0;
}

export async function getAdminUserByName(
  username: string
): Promise<{ id: string; username: string; password_hash: string } | null> {
  const rows = await query<{ id: string; username: string; password_hash: string }>(
    "SELECT id::text AS id, username, password_hash FROM admin_users WHERE lower(username) = lower($1) LIMIT 1",
    [username.trim()]
  );
  return rows[0] ?? null;
}

/** Verify a login against the DB users. Returns {username, tag} (canonical), else null. */
export async function verifyAdminUser(
  username: string,
  password: string
): Promise<{ username: string; tag: string | null } | null> {
  const rows = await query<{ id: string; username: string; password_hash: string; sms_tag: string | null }>(
    "SELECT id, username, password_hash, sms_tag FROM admin_users WHERE lower(username) = lower($1) LIMIT 1",
    [username.trim()]
  );
  if (rows.length === 0) return null;
  const ok = await verifyPassword(password, rows[0].password_hash);
  if (!ok) return null;
  await query("UPDATE admin_users SET last_login_at = NOW() WHERE id = $1", [rows[0].id]);
  return { username: rows[0].username, tag: rows[0].sms_tag ?? null };
}

/** Change a DB user's own password (verifies current first). Returns a status. */
export async function changeAdminUserPassword(
  username: string,
  currentPassword: string,
  newPassword: string
): Promise<"ok" | "not-db-user" | "wrong-current"> {
  const rows = await query<{ id: string; password_hash: string }>(
    "SELECT id, password_hash FROM admin_users WHERE lower(username) = lower($1) LIMIT 1",
    [username.trim()]
  );
  if (rows.length === 0) return "not-db-user";
  const ok = await verifyPassword(currentPassword, rows[0].password_hash);
  if (!ok) return "wrong-current";
  const hash = await hashPassword(newPassword);
  await query("UPDATE admin_users SET password_hash = $1 WHERE id = $2", [hash, rows[0].id]);
  return "ok";
}
