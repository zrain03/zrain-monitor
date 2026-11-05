-- Pembangun / Developer: Zrain
-- Dicipta / Created (rekod Git terawal / first Git evidence): 2026-10-30
-- Dikemas kini / Last updated: 2026-11-04
-- Fail / File: migrations/0004_reliability.sql
-- BM: Migrasi skema D1 yang diperlukan mengikut turutan.
-- EN: Ordered D1 schema migration required for deployment.
-- Independent, optional Telegram connectivity tests. Never store Telegram chat IDs or bot tokens here.
CREATE TABLE IF NOT EXISTS telegram_test_deliveries (
  id TEXT PRIMARY KEY,
  owner_uid TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('SENDING','SENT','FAILED')),
  sent_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_telegram_test_owner_time ON telegram_test_deliveries(owner_uid,created_at DESC);
CREATE TABLE IF NOT EXISTS telegram_test_limits (
  owner_uid TEXT PRIMARY KEY REFERENCES users(uid) ON DELETE CASCADE,
  next_allowed_at TEXT NOT NULL
);
