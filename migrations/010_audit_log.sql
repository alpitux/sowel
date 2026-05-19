-- Spec 113 — Audit log
-- Persists security-sensitive actions: auth, user CRUD, settings,
-- mode, backup, plugin install. Queried by GET /api/v1/audit
-- (admin only), purged at boot for entries older than 365 days.

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_kind TEXT NOT NULL,
  actor_user_id TEXT,
  actor_label TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  ip TEXT,
  meta TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_user_id ON audit_log (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log (action);
