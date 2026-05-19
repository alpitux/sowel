# Spec 113 — Audit log

> Persisted trail of security-sensitive actions, written at the API
> route layer where the actor identity and source IP are known.
> Queryable through a paginated admin endpoint, retained for one year,
> purged automatically at boot.

## Problem

Sowel today logs operational events through pino (info / warn / error
into `data/logs/sowel.N.log` and the ring buffer). But pino logs are
free-form prose, not a queryable trail. When an incident happens — a
user reports a token they did not create, a setting changed
overnight, a mode activated by surprise, a backup was downloaded — the
only way to investigate is to grep through rotating log files and
hope the right info was captured.

Audit finding F13, Medium severity, S effort, Security category. No
audit trail exists for:

- Successful and failed logins, logout, token refresh
- API token creation and deletion
- User CRUD (create, update, role change, password change, delete)
- Settings changes via the API
- Mode activation
- Backup export
- Plugin install and uninstall

Without a dedicated `audit_log`, every future security incident
(stolen credential, hostile family member, compromised plugin author)
starts blind.

## Goal

Introduce a structured `audit_log` SQLite table backed by a small
`AuditLogger` service. The service is called from the API route
layer at every security-sensitive entry point, captures the actor
identity, the source IP, the action, the target, and a JSON `meta`
blob with redacted context.

A paginated admin-only endpoint `GET /api/v1/audit` exposes the trail
for future UI integration. A purge runs at boot to drop entries
older than 365 days.

## Non-goals

- **Auditing every internal mutation**: settings writes from plugins
  (e.g. Netatmo refreshing its OAuth token every hour) are NOT
  audited. The audit boundary is "human or external-actor request
  reaching an API route", not "any call to a manager method". Auditing
  the internal path would flood the trail with autonomous noise.
- **Tamper-resistance / cryptographic chain**: this is a normal SQLite
  table. Anyone with file access to `data/sowel.db` can edit or wipe
  it (same as the rest of Sowel). Detecting tampering is out of scope
  and would require an append-only store / signed blocks.
- **Indefinite retention**: rotation at 365 days. The user picked this
  in the spec-time question. A future spec can extend or shorten.
- **Real-time UI**: the endpoint returns paginated history. WebSocket
  push, live tail, notifications on suspicious events: all future.
- **External SIEM integration**: no syslog forwarder, no Webhook on
  audit event. The trail is local to the SQLite DB.
- **Forensic chain-of-custody guarantees**: this is a developer-level
  audit aid, not a courtroom-grade log.

## Scope (events audited)

The selected scope is "Sécurité étendue", agreed at spec time:

### Auth (`auth.*`)

- `auth.login.success` : successful login
- `auth.login.failure` : login attempt with wrong password / unknown user
- `auth.logout` : explicit logout
- `auth.token.refresh` : refresh token exchange (silent in normal use, noteworthy if anomalous)
- `auth.api_token.create` : new API token issued (`swl_…`)
- `auth.api_token.delete` : API token revoked

### Users (`user.*`)

- `user.create` : new user added
- `user.update` : user fields changed (username, role)
- `user.password_change` : password updated (no payload, just the action)
- `user.delete` : user removed

### Settings (`settings.*`)

- `settings.update` : per-key change via `PUT /api/v1/settings/:key` (one entry per key). Values are redacted from `meta` when the key matches `password|token|secret|apiKey` (same patterns as pino's redact paths).

### Modes (`mode.*`)

- `mode.activate` : user activated a mode
- `mode.deactivate` : user deactivated a mode

### Backups (`backup.*`)

- `backup.export` : the backup ZIP was downloaded (significant: exfiltration vector)
- `backup.restore` : a backup was uploaded and applied

### Plugins (`plugin.*`)

- `plugin.install` : new plugin installed from GitHub (records repo + version + sha256 + owner)
- `plugin.uninstall` : plugin removed
- `plugin.update` : plugin updated to a new version (from + to versions)
- `plugin.enable` / `plugin.disable` : enable flag toggled

Each entry carries the actor (user id + label) and the originating IP
when available (Fastify `request.ip`). The full entry shape is in
`architecture.md`.

## Approach

A new table `audit_log` (migration 010), a new `AuditLogger` service
in `src/core/audit-logger.ts`, and call sites in the existing API
route registrars. The service is wired through Fastify so any route
handler can call `request.server.audit.log({ ... })` or via a closure
captured at registration time.

The logger never throws. If the insert fails (disk full, DB locked),
the audit miss is logged to pino at `error` level and the underlying
operation completes normally. Auditing must never block business.

A purge function `auditLogger.purgeOlderThan(days)` is called once at
boot from `src/index.ts`, with `days = 365`. The purge is a single
`DELETE FROM audit_log WHERE timestamp < ?` and runs synchronously
(SQLite, fast).

The endpoint `GET /api/v1/audit` is registered in
`src/api/routes/audit.ts`, protected by `requireRole("admin")`,
returns paginated rows in reverse chronological order.

## Acceptance criteria

A successful login through `POST /api/v1/auth/login`:

- Inserts one row in `audit_log` with `action = "auth.login.success"`,
  `actor_user_id = <user.id>`, `actor_label = <username>`,
  `ip = <request.ip>`.

A failed login (wrong password):

- Inserts one row with `action = "auth.login.failure"`,
  `actor_user_id = null`, `actor_label = <attempted username>`,
  `meta = { reason: "invalid_credentials" }`.

A settings update through `PUT /api/v1/settings/integration.netatmo.refresh_token`:

- Inserts one row with `action = "settings.update"`,
  `target_id = "integration.netatmo.refresh_token"`, but the
  `meta` field contains `{ valueRedacted: true }` — never the actual
  value. Non-secret keys (e.g. `home.latitude`) record
  `meta = { oldValue, newValue }`.

A mode activation through `POST /api/v1/modes/:id/activate`:

- Inserts one row with `action = "mode.activate"`,
  `target_type = "mode"`, `target_id = <modeId>`,
  `meta = { modeName: "Night" }`.

A backup export through `POST /api/v1/backup/export`:

- Inserts one row with `action = "backup.export"`, `meta` carrying
  the byte size of the produced archive.

After 365 days, the row is purged automatically at next Sowel boot.

The endpoint `GET /api/v1/audit?limit=50&action=auth.` returns the
last 50 auth-prefixed entries, in reverse chronological order, for
admin role only. Non-admin gets 403.

## Verification (manual)

After deploy, log in via the UI, then:

```bash
sqlite3 data/sowel.db "SELECT action, actor_label, target_id, timestamp FROM audit_log ORDER BY timestamp DESC LIMIT 10;"
```

The login should appear. Issue a bad-password attempt and confirm a
`auth.login.failure` row appears. Activate a mode, check the row.
Settings updates from the UI should also appear.

The unit + integration tests in `plan.md` cover the same paths
without needing the manual check.
