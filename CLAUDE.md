# Checkin Admin — project context

Admin panel for **checkin.co.in** (Hotel Arco Palace check-in software).
Live, in production. This file is the handover: read it before changing anything.

## What it is

Next.js 15 (App Router) + TypeScript + Tailwind v4 + Postgres. A password-protected
admin area with a dashboard and an SMS list, plus two APIs that let the hotel's
check-in software and its SMS gateway push messages in.

The **public site at `/`** is the owner's original checkin.co.in marketing site, restored
from the Wayback Machine snapshot of 2 Apr 2023 (`20230402024347`). It is plain static
HTML in `public/` — `index.html` (also `index-2.html`), `aboutus.html`, `service.html`,
`contact_us.html`, `client.html`, plus `css/`, `js/`, `images/`. A rewrite in
`next.config.ts` maps `/` to `/index.html`; there is no `app/page.tsx`. Do not "modernise"
these files unasked — they are a faithful restore. Known gaps: the homepage Flash banner
(`flash/checkin banner.swf`) cannot play in any current browser, the `Check-In.msi` and
`SMSExcel2007AddInSetup.msi` download links were not restored, and `client.html` was
already a MySQL error page when the snapshot was taken.

## Live URLs

| What | Where |
| --- | --- |
| Site | https://checkin.co.in — admin at `/admin` |
| Fallback | https://checkin-admin-ten.vercel.app |
| Repo | https://github.com/hotelarcopalace-glitch/checkin-admin (private) |
| Vercel project | `checkin-admin` in scope `hotelarcopalace-glitchs-projects` |

Admin username is `admin`. The password is only in `.env.local` (never committed) and
in the Vercel env vars as a scrypt hash. Lost it? Run `npm run gen:admin` and update
`ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH` in Vercel, then redeploy.

## Infrastructure

- **Hosting:** Vercel, auto-deploys on every push to `main`. The Vercel CLI is logged in
  on the owner's Mac, so `vercel env`, `vercel redeploy`, `vercel domains` all work.
- **Database:** Neon Postgres, resource `neon-citrine-tree`, free plan, Singapore region,
  provisioned through the Vercel marketplace. It injects `DATABASE_URL` automatically —
  **never set that variable by hand.**
- **Domain:** checkin.co.in is registered at **GoDaddy** (nameservers `domaincontrol.com`).
  There is no GoDaddy API access here; DNS edits are manual, done by the owner.
  Current records: `A @ → 64.29.17.1`, `CNAME www → 8e06b7d491dac3d9.vercel-dns-017.com`.
  SSL is Let's Encrypt, issued and renewed by Vercel.
- The owner also has a **Hostinger** account (arcoautozone.in/.com, carspareparts.co.in,
  and a KVM 2 VPS running WordPress). Unrelated to this project — do not touch it.

## Environment variables

`ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, `SMS_API_KEY`,
`DATABASE_URL` (from Neon), optional `DB_POOL_MAX`, `SITE_URL`, `OTP_SKIP`.

Push notifications additionally need `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
`FIREBASE_PRIVATE_KEY` (server) and `NEXT_PUBLIC_FIREBASE_API_KEY`,
`NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`,
`NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`,
`NEXT_PUBLIC_FIREBASE_VAPID_KEY` (client). **All of these are set in Vercel** (production,
preview and development) and push has been confirmed working on a real Android phone.

Firebase project is **`checkin-3715a`**, service account
`firebase-adminsdk-u7h1t@checkin-3715a.iam.gserviceaccount.com`. The downloaded service
account JSON lives at `~/Downloads/checkin-3715a-firebase-adminsdk-u7h1t-b90d130418.json`
on the owner's Mac — it is the only local copy of the private key, and it is **not** in the
repo. Regenerate it from the Firebase console if it is ever lost.

Two Vercel CLI traps when setting these: `NEXT_PUBLIC_*` variables are rejected as
"sensitive", so they need `--no-sensitive --visibility config`; and `FIREBASE_PRIVATE_KEY`
starts with `-----BEGIN`, which the CLI reads as a flag, so it must be piped through stdin
rather than passed with `--value`. Always confirm with `vercel env ls` afterwards — adds
can fail silently.

## Guest login and push

`/user/login` takes a mobile number, issues a six-digit OTP into `otp_codes`, and
`/user` shows that number's messages plus a "turn on notifications" button. The button
asks for browser permission, gets an FCM token and stores it in `device_tokens`.
`lib/sms-insert.ts` then pushes to every token on that number after each insert, logging
outcomes to `notification_log`.

`OTP_SKIP` is now **false** in Netlify (set 2 Oct 2026): codes are really verified and the
code is never returned to the browser or shown on the site. There is no SMS gateway yet, so
nobody receives it — admins read it from the Web Users page and pass it on; guests can
also log in with a password (admin can create accounts with one) or a magic link. Setting
`OTP_SKIP=true` again would re-open "any code works", so don't. When SMS sending is wired,
`app/api/user/otp/send/route.ts` has the TODO where the code should be sent.

FCM uses the HTTP v1 API with a service account; `lib/fcm.ts` mints the Google OAuth token
itself with `jose`, so `firebase-admin` is deliberately not a dependency. Dead tokens are
deleted when Google reports UNREGISTERED.

Multi-login behaviour is tested and works: one number may register up to 20 devices and
every one of them is pushed; different numbers can be logged in at the same time and never
see each other's messages; and if a second number logs in on a browser that already has a
token, the token moves to the new number (`ON CONFLICT (token) DO UPDATE`). Push failures
never fail the insert — the vendor always gets `code: 0`.

Note that `NEXT_PUBLIC_*` values are inlined at build time, so changing them needs a real
rebuild. When push silently does nothing, check in this order: the JSON response's `push`
field (`no devices registered` means the browser never registered), then the browser's own
permission state — the toggle prints a diagnostics line (`permission · serviceWorker ·
push · secure`) under the button for exactly this.

## Endpoints

| Route | Auth | Purpose |
| --- | --- | --- |
| `POST /api/auth/login` | — | admin login, sets a 12h signed JWT cookie |
| `POST /api/auth/logout` | — | clears the cookie |
| `GET /api/sms/export` | admin session | CSV of the current filter |
| `POST /api/admin/db-setup` | admin session | applies `db/schema.sql`, `?seed=1` adds demo rows. Idempotent. |
| `POST /api/admin/clear-sms` | admin session | deletes every message; body must be `{"confirm":"DELETE"}` |
| `POST /api/sms/log` | `SMS_API_KEY` | structured insert, 1–100 messages, full validation |
| `GET\|POST /api/sms/SMSInsert` | **none — open** | vendor endpoint: `mobileNo` + `smsText`, returns `{code:0}` / `{code:1}` |

`SMSInsert` is also served at `/api/sms/insert` and `/newadmin/api/sms/SMSInsert`;
all three share `lib/sms-insert.ts`. It mirrors the contract of the owner's existing
hotelarcopalace.com API so the SMS vendor needs no changes. It is deliberately
unauthenticated at the owner's request — only a 60/minute per-IP limit guards it.

## Gotchas learned the hard way

- **Vercel env vars added through the dashboard came back empty at runtime.** Names showed
  in `vercel env ls` but `process.env` was blank. Re-adding them with `vercel env add`
  fixed it. Always verify at runtime, not just in the listing.
- **Sensitive env vars cannot be read back** — `vercel env pull` returns `[SENSITIVE]`.
  That is why `/api/admin/db-setup` exists: it runs the schema from inside the deployment
  where `DATABASE_URL` is available.
- **Marketplace integrations need the owner to accept vendor terms in a browser.**
  `vercel integration add` fails until they do.
- **Env var changes need a redeploy** (`vercel redeploy <url>`) to take effect.
- After a DNS change, browsers cache the old IP and certificate for a while — verify with
  `curl --resolve` before assuming something is broken.

## Working style that fits this project

- There is no local Postgres. To test database code, install `@electric-sql/pglite` and
  `@electric-sql/pglite-socket` with `--no-save`, serve on a port, and point
  `DATABASE_URL` at it with `DB_POOL_MAX=1` (the socket server takes one connection).
  Clean the packages up afterwards.
- Verify against the live site with `curl` before telling the owner it works.
- The owner writes in Hinglish and prefers that back. They want the work done for them,
  not instructions — do every step you can and only hand over what genuinely needs their
  account access.

## State as of 22 Aug 2026

Live and verified end to end:

- Public site at `/` (restored 2023 snapshot), admin at `/admin`, guest area at `/user`.
- Both insert APIs, CSV export, filters, clear-messages action.
- Guest login by mobile number, device registration, and **real push delivered to an
  Android phone** (`{"push":{"sent":1,"failed":0}}`).

The database is **empty** — every demo and test row was cleared after testing.

**Pending, in the owner's priority order:**

1. **Real OTP sending.** The on-screen code is gone and `OTP_SKIP=false`, but the OTP is not
   delivered to the guest at all yet (see above). The SMS vendor already calls `SMSInsert`, so
   sending the OTP through the same gateway is the obvious route.
2. **The homepage Flash banner.** The 2023 site embeds `flash/checkin banner.swf`, which no
   browser can play, leaving a blank band on the homepage. The owner asked for a static
   image in its place; not done yet.
3. **Legacy Cloud Messaging API** is still enabled in Firebase and its server key was
   visible in a screenshot the owner shared. It was deprecated in 2024 and nothing here
   uses it — worth disabling.

Also raised earlier: pulling logs directly from the SMS provider (MSG91/Textlocal/
Fast2SMS/Twilio — not chosen), serving the same API on hotelarcopalace.com, and more admin
pages (bookings, guests, reports).
