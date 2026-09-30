CREATE TABLE IF NOT EXISTS sms_messages (
  id          BIGSERIAL PRIMARY KEY,
  recipient   TEXT        NOT NULL,
  guest_name  TEXT,
  message     TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'queued',
  provider    TEXT,
  template    TEXT,
  segments    INTEGER     NOT NULL DEFAULT 1,
  cost        NUMERIC(10,4) NOT NULL DEFAULT 0,
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS sms_messages_created_at_idx ON sms_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS sms_messages_status_idx     ON sms_messages (status);
CREATE INDEX IF NOT EXISTS sms_messages_recipient_idx  ON sms_messages (recipient);

-- Source IP of the gateway that called SMSInsert (added with the new list design).
ALTER TABLE sms_messages ADD COLUMN IF NOT EXISTS source_ip TEXT;


-- ---------------------------------------------------------------------------
-- Guest-facing login + push notifications
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS app_users (
  id            BIGSERIAL PRIMARY KEY,
  mobile        TEXT        NOT NULL UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- Guest profile: name + details they can edit for themselves.
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS dob TEXT;
-- Optional password login, as a fallback when OTP delivery isn't available.
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE TABLE IF NOT EXISTS otp_codes (
  id         BIGSERIAL PRIMARY KEY,
  mobile     TEXT        NOT NULL,
  code       TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS otp_codes_mobile_idx ON otp_codes (mobile, created_at DESC);

CREATE TABLE IF NOT EXISTS device_tokens (
  id           BIGSERIAL PRIMARY KEY,
  mobile       TEXT        NOT NULL,
  token        TEXT        NOT NULL UNIQUE,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS device_tokens_mobile_idx ON device_tokens (mobile);

CREATE TABLE IF NOT EXISTS notification_log (
  id         BIGSERIAL PRIMARY KEY,
  sms_id     BIGINT,
  mobile     TEXT,
  token      TEXT,
  ok         BOOLEAN     NOT NULL DEFAULT FALSE,
  error      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notification_log_created_idx ON notification_log (created_at DESC);


-- ---------------------------------------------------------------------------
-- Admin panel users (created in-panel). The env ADMIN_USERNAME /
-- ADMIN_PASSWORD_HASH login stays as a bootstrap / recovery account.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS admin_users (
  id            BIGSERIAL PRIMARY KEY,
  username      TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- A user with an sms_tag is a HOTEL login: it can only see SMS whose text
-- contains that tag (e.g. "@Arco Team"), and nothing else in the panel.
-- A user with a NULL/empty tag is a full super-admin.
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS sms_tag TEXT;


-- ---------------------------------------------------------------------------
-- Magic login links. checkin.exe calls POST /api/magic/create to mint a short
-- login URL (checkin.co.in/l/<token>) which it then puts inside the OTP SMS it
-- sends itself. Opening the link logs the guest in (sets the user cookie) and
-- lands them on /sms. The website only MINTS links — it never sends SMS.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS magic_links (
  token      TEXT        PRIMARY KEY,
  mobile     TEXT        NOT NULL,
  hotel_tag  TEXT,
  name       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS magic_links_mobile_idx ON magic_links (mobile);
CREATE INDEX IF NOT EXISTS magic_links_expires_idx ON magic_links (expires_at);


-- ---------------------------------------------------------------------------
-- BuildKhata — builder / construction project expense book. A small team
-- (~5 site staff) logs, per project, payment received + material purchase +
-- labour payment, and sees balance and category-wise totals. Shared data:
-- every logged-in user sees the same projects and entries.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS build_users (
  id            BIGSERIAL PRIMARY KEY,
  username      TEXT        NOT NULL UNIQUE,
  name          TEXT        NOT NULL,
  password_hash TEXT        NOT NULL,
  active        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS build_projects (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT        NOT NULL,
  client     TEXT,
  archived   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS build_entries (
  id         BIGSERIAL PRIMARY KEY,
  project_id BIGINT      NOT NULL REFERENCES build_projects(id) ON DELETE CASCADE,
  kind       TEXT        NOT NULL CHECK (kind IN ('IN','MAT','LAB')),
  category   TEXT,
  amount     NUMERIC(14,2) NOT NULL,
  entry_date DATE        NOT NULL,
  party      TEXT,
  note       TEXT,
  user_name  TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS build_entries_project_idx ON build_entries (project_id);
CREATE INDEX IF NOT EXISTS build_entries_date_idx    ON build_entries (entry_date DESC);
