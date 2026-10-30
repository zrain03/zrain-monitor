-- Email alerts are opt-in for each monitor. Existing in-app notifications are unchanged.
CREATE TABLE IF NOT EXISTS monitor_alert_settings (
  monitor_id TEXT PRIMARY KEY REFERENCES monitors(id) ON DELETE CASCADE,
  owner_uid TEXT NOT NULL,
  email_enabled INTEGER NOT NULL DEFAULT 0 CHECK(email_enabled IN (0,1)),
  delivery_email TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_monitor_alert_owner ON monitor_alert_settings(owner_uid);

-- An outbox is committed alongside each confirmed status change.
CREATE TABLE IF NOT EXISTS email_alert_outbox (
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
  provider_id TEXT,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_email_outbox_due ON email_alert_outbox(status,next_attempt_at,claim_until);
