import { importPKCS8, SignJWT } from "jose";
import { query } from "./db";

/**
 * Firebase Cloud Messaging over the HTTP v1 API, using a service account.
 * No firebase-admin dependency — we mint the Google OAuth token ourselves.
 *
 * Needs FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.
 */

export function fcmConfigured() {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
  );
}

let cached: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const email = process.env.FIREBASE_CLIENT_EMAIL!;
  // Vercel stores the key with literal \n sequences.
  const pem = process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n");
  const key = await importPKCS8(pem, "RS256");

  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(email)
    .setSubject(email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const body = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(`Google OAuth failed: ${body.error ?? res.status}`);
  }

  cached = { token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return cached.token;
}

export type PushResult = { sent: number; failed: number; skipped?: string };

/**
 * Sends one notification to every device registered against `mobile`.
 * Never throws — the caller is an insert endpoint that must not fail because
 * a push could not be delivered.
 */
export async function pushToMobile(
  mobile: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<PushResult> {
  if (!fcmConfigured()) return { sent: 0, failed: 0, skipped: "FCM not configured" };

  let devices: { token: string }[] = [];
  try {
    devices = await query<{ token: string }>(
      `SELECT token FROM device_tokens WHERE mobile = $1 ORDER BY last_seen_at DESC LIMIT 20`,
      [mobile]
    );
  } catch {
    return { sent: 0, failed: 0, skipped: "device_tokens unavailable" };
  }
  if (devices.length === 0) return { sent: 0, failed: 0, skipped: "no devices registered" };

  let token: string;
  try {
    token = await accessToken();
  } catch (err) {
    await log(data.smsId, mobile, null, false, err instanceof Error ? err.message : "auth failed");
    return { sent: 0, failed: devices.length, skipped: "google auth failed" };
  }

  const url = `https://fcm.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/messages:send`;
  const site = process.env.SITE_URL ?? "https://checkin.co.in";
  // Tapping the notification lands on the on-site SMS page with that SMS highlighted.
  const deepPath = data.smsId ? `/sms?hl=${encodeURIComponent(data.smsId)}` : "/sms";
  const deepLink = `${site}${deepPath}`;
  let sent = 0;
  let failed = 0;

  for (const device of devices) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token: device.token,
            // Data-only on purpose: a top-level "notification" makes Firebase
            // auto-display its own (logo-less) popup on top of the one our
            // service worker shows, so every SMS arrived twice.
            data: { ...data, title, body, url: deepPath },
            webpush: {
              headers: { Urgency: "high" },
              fcmOptions: { link: deepLink },
            },
          },
        }),
      });

      if (res.ok) {
        sent += 1;
        await log(data.smsId, mobile, device.token, true, null);
      } else {
        failed += 1;
        const text = await res.text();
        await log(data.smsId, mobile, device.token, false, text.slice(0, 300));
        // A token that the device no longer owns is dead weight — drop it.
        if (res.status === 404 || text.includes("UNREGISTERED") || text.includes("INVALID_ARGUMENT")) {
          await query(`DELETE FROM device_tokens WHERE token = $1`, [device.token]).catch(() => {});
        }
      }
    } catch (err) {
      failed += 1;
      await log(data.smsId, mobile, device.token, false, err instanceof Error ? err.message : "send failed");
    }
  }

  return { sent, failed };
}

async function log(
  smsId: string | undefined,
  mobile: string,
  token: string | null,
  ok: boolean,
  error: string | null
) {
  try {
    await query(
      `INSERT INTO notification_log (sms_id, mobile, token, ok, error) VALUES ($1, $2, $3, $4, $5)`,
      [smsId ? Number(smsId) : null, mobile, token, ok, error]
    );
  } catch {
    /* logging must never break sending */
  }
}
