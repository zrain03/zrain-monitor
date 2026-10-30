-- Optional Telegram notifications, independent from in-app and email alerts.
-- No Telegram delivery is enabled without an explicit account link and monitor opt-in.
CREATE TABLE IF NOT EXISTS telegram_connections (
  owner_uid TEXT PRIMARY KEY REFERENCES users(uid) ON DELETE CASCADE,
  chat_id TEXT NOT NULL UNIQUE,
  connected_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS telegram_link_tokens (
  owner_uid TEXT PRIMARY KEY REFERENCES users(uid) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS telegram_alert_settings (
  monitor_id TEXT PRIMARY KEY REFERENCES monitors(id) ON DELETE CASCADE,
  owner_uid TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS telegram_alert_outbox (
  notification_id TEXT PRIMARY KEY REFERENCES notifications(id) ON DELETE CASCADE,
  monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  owner_uid TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('DOWN','RECOVERED')),
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SENDING','SENT','FAILED')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  claim_token TEXT,
  claim_until TEXT,
  sent_at TEXT,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_telegram_outbox_due ON telegram_alert_outbox(status,next_attempt_at,claim_until);
CREATE INDEX IF NOT EXISTS idx_telegram_settings_owner ON telegram_alert_settings(owner_uid);