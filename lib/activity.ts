import { query } from "./db";

export type ActivityEvent = "login" | "logout" | "created";
export type ActivityMethod = "otp" | "password" | "magic_link" | "admin";

/** Best-effort audit row: a failed write (e.g. table not migrated yet) must never break the request. */
export async function logActivity(
  mobile: string,
  event: ActivityEvent,
  method: ActivityMethod | null,
  req: Request
) {
  try {
    const ip =
      req.headers.get("x-nf-client-connection-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      null;
    await query(
      `INSERT INTO user_activity (mobile, event, method, ip, user_agent) VALUES ($1, $2, $3, $4, $5)`,
      [mobile, event, method, ip, req.headers.get("user-agent")?.slice(0, 300) ?? null]
    );
  } catch {
    /* audit only */
  }
}

/** "Chrome · Android" style summary of a user-agent string. */
export function deviceLabel(ua: string | null): string {
  if (!ua) return "—";
  const os = /android/i.test(ua)
    ? "Android"
    : /iphone|ipad|ipod/i.test(ua)
      ? "iOS"
      : /windows/i.test(ua)
        ? "Windows"
        : /mac os/i.test(ua)
          ? "Mac"
          : /linux/i.test(ua)
            ? "Linux"
            : "";
  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /samsungbrowser/i.test(ua)
      ? "Samsung Internet"
      : /chrome|crios/i.test(ua)
        ? "Chrome"
        : /firefox|fxios/i.test(ua)
          ? "Firefox"
          : /safari/i.test(ua)
            ? "Safari"
            : "";
  return [browser, os].filter(Boolean).join(" · ") || "Other";
}
