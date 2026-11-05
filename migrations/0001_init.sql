-- Pembangun / Developer: Zrain
-- Dicipta / Created (rekod Git terawal / first Git evidence): 2026-10-30
-- Dikemas kini / Last updated: 2026-11-04
-- Fail / File: migrations/0001_init.sql
-- BM: Migrasi skema D1 yang diperlukan mengikut turutan.
-- EN: Ordered D1 schema migration required for deployment.
CREATE TABLE IF NOT EXISTS users (
  uid TEXT PRIMARY KEY, email TEXT, created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS monitors (
  id TEXT PRIMARY KEY, owner_uid TEXT NOT NULL, name TEXT NOT NULL,
  url TEXT NOT NULL, purpose TEXT NOT NULL CHECK (purpose IN ('uptime','keepawake')),
  state TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (state IN ('ACTIVE','PAUSED')),
  status TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK (status IN ('UNKNOWN','UP','VERIFYING','DOWN')),
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  consecutive_successes INTEGER NOT NULL DEFAULT 0,
  last_checked_at TEXT, next_check_at TEXT, last_response_ms INTEGER,
  last_http_status INTEGER, total_checks INTEGER NOT NULL DEFAULT 0,
  lease_token TEXT, lease_until TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_monitors_due ON monitors(state,next_check_at,lease_until);
CREATE INDEX IF NOT EXISTS idx_monitors_owner ON monitors(owner_uid,created_at);
CREATE TABLE IF NOT EXISTS check_results (
  id TEXT PRIMARY KEY, monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  checked_at TEXT NOT NULL, duration_ms INTEGER NOT NULL, success INTEGER NOT NULL,
  http_status INTEGER, error_code TEXT, mode TEXT NOT NULL CHECK(mode IN('scheduled','manual'))
);
CREATE INDEX IF NOT EXISTS idx_checks_monitor_time ON check_results(monitor_id,checked_at DESC);
CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY, monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL, resolved_at TEXT, reason TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_incidents_monitor_time ON incidents(monitor_id,started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_incident_open ON incidents(monitor_id) WHERE resolved_at IS NULL;
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY, owner_uid TEXT NOT NULL, monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN('DOWN','RECOVERED')), created_at TEXT NOT NULL, read_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_notifications_owner_time ON notifications(owner_uid,created_at DESC);
CREATE TABLE IF NOT EXISTS scheduler_runs (
  id TEXT PRIMARY KEY, started_at TEXT NOT NULL, finished_at TEXT,
  claimed INTEGER NOT NULL DEFAULT 0, succeeded INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0, error TEXT
);
CREATE INDEX IF NOT EXISTS idx_scheduler_time ON scheduler_runs(started_at DESC);
CREATE TABLE IF NOT EXISTS daily_summaries (
  monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  day TEXT NOT NULL, checks INTEGER NOT NULL DEFAULT 0, successful INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0, total_duration_ms INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (monitor_id,day)
);
