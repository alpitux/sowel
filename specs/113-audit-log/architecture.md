# Spec 113 — Architecture

One new SQLite table, one new module, one new admin route, and a
modest set of call sites in existing route registrars. No event bus
changes, no plugin API changes, no UI changes shipped in this spec
(the UI page that consumes the endpoint is a separate, future spec).

## Files touched

| File                                           | Change                                                                                                                       |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `migrations/010_audit_log.sql`                 | **New**. Creates `audit_log` table + 3 indexes                                                                               |
| `src/core/audit-logger.ts`                     | **New**. `AuditLogger` class with `log()`, `query()`, `purgeOlderThan()`                                                     |
| `src/core/audit-logger.test.ts`                | **New**. Unit tests on insert / query / purge / error swallow / redaction                                                    |
| `src/shared/types.ts`                          | Add `AuditEntry`, `AuditEntryRow`, `AuditQueryParams`                                                                        |
| `src/index.ts`                                 | Instantiate `AuditLogger`, call `purgeOlderThan(365)` at boot, pass to API server                                            |
| `src/api/server.ts`                            | Decorate Fastify app with `auditLogger`; pass to each route registrar that needs it                                          |
| `src/api/routes/auth.ts`                       | Call `auditLogger.log()` on login / logout / refresh / token create / token delete                                           |
| `src/api/routes/users.ts`                      | Same for user CRUD + password change                                                                                         |
| `src/api/routes/settings.ts`                   | Same for `PUT /settings/:key` and `PUT /settings` (bulk) with redaction                                                      |
| `src/api/routes/modes.ts`                      | Same for activate / deactivate                                                                                               |
| `src/api/routes/backup.ts`                     | Same for export / restore                                                                                                    |
| `src/api/routes/plugins.ts` (or `packages.ts`) | Same for install / uninstall / update / enable / disable                                                                     |
| `src/api/routes/audit.ts`                      | **New**. `GET /api/v1/audit` admin-only, paginated, filtrable                                                                |
| `src/api/server.ts`                            | Register the new route                                                                                                       |
| `docs/release-notes.md` + `.fr.md`             | New bullet in the existing v1.11.1 `### v1.11.1 — 2026-05-19 { #v1-11-1 }` block (we are batching F03 + F13 in this release) |
| `docs/specs-index.md` + `.fr.md`               | New V1.11 row for spec 113                                                                                                   |
| `docs/technical/api-reference.md`              | Document `GET /api/v1/audit` and the audit action vocabulary                                                                 |

## Database schema

`migrations/010_audit_log.sql`:

```sql
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
```

Column rationale:

- `id` UUID v4 — same convention as the rest of Sowel.
- `timestamp` defaults to `CURRENT_TIMESTAMP` (ISO 8601, UTC).
- `actor_kind` is `"user"` (interactive session via JWT), `"api_token"`
  (request authenticated via an `swl_…` token), or `"system"` (internal
  triggers like the boot purge, self-update). String column, not an
  enum, for plugin/system extensibility later.
- `actor_user_id` is the owning user when known (for both `user` and
  `api_token` kinds). NULL for system events.
- `actor_label` is human-readable: username for `user`, token name
  for `api_token`, `"system"` for `system`.
- `action` is dot-delimited string (`auth.login.success`,
  `settings.update`, `plugin.install`). The vocabulary is documented
  in `spec.md` § Scope and in `api-reference.md`.
- `target_type` and `target_id` capture what was acted on. For
  `auth.login.success`, target_type = `"user"`, target_id = user id.
  For `settings.update`, target_type = `"settings"`, target_id is
  the key. Nullable.
- `ip` is `request.ip` from Fastify when available, NULL otherwise.
- `meta` is a JSON-stringified object for any extra context that
  doesn't fit elsewhere. Values are redacted before stringification
  if the action concerns secret-bearing keys.

## TypeScript types

In `src/shared/types.ts`:

```ts
export type AuditActorKind = "user" | "api_token" | "system";

export interface AuditEntry {
  actorKind: AuditActorKind;
  actorUserId?: string | null;
  actorLabel: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  ip?: string | null;
  meta?: Record<string, unknown> | null;
}

export interface AuditEntryRow extends AuditEntry {
  id: string;
  timestamp: string; // ISO 8601 UTC
}

export interface AuditQueryParams {
  actorUserId?: string;
  actionPrefix?: string; // e.g. "auth." matches "auth.login.success"
  since?: string; // ISO 8601
  until?: string; // ISO 8601
  limit?: number; // default 100, max 500
  offset?: number; // default 0
}
```

## `AuditLogger` module

```ts
// src/core/audit-logger.ts

import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { Logger } from "./logger.js";
import type { AuditEntry, AuditEntryRow, AuditQueryParams } from "../shared/types.js";

const SENSITIVE_KEY_PATTERNS = [/password/i, /token/i, /secret/i, /api_?key/i];

const RETENTION_DAYS = 365;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export class AuditLogger {
  private db: Database.Database;
  private logger: Logger;
  private stmts: {
    insert: Database.Statement;
    queryBase: string; // built dynamically per query
    purge: Database.Statement;
    count: Database.Statement;
  };

  constructor(db: Database.Database, logger: Logger) {
    this.db = db;
    this.logger = logger.child({ module: "audit-logger" });
    this.stmts = {
      insert: db.prepare(
        `INSERT INTO audit_log
          (id, timestamp, actor_kind, actor_user_id, actor_label, action,
           target_type, target_id, ip, meta)
         VALUES (@id, @timestamp, @actorKind, @actorUserId, @actorLabel, @action,
                 @targetType, @targetId, @ip, @meta)`,
      ),
      queryBase:
        "SELECT id, timestamp, actor_kind, actor_user_id, actor_label, action," +
        " target_type, target_id, ip, meta FROM audit_log",
      purge: db.prepare(
        "DELETE FROM audit_log WHERE timestamp < datetime('now', '-' || ? || ' days')",
      ),
      count: db.prepare("SELECT COUNT(*) AS n FROM audit_log"),
    };
  }

  /**
   * Persist an audit entry. NEVER throws — a DB failure is logged
   * to pino at error level and the caller continues normally.
   * Auditing must not block the underlying operation.
   */
  log(entry: AuditEntry): void {
    try {
      this.stmts.insert.run({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        actorKind: entry.actorKind,
        actorUserId: entry.actorUserId ?? null,
        actorLabel: entry.actorLabel,
        action: entry.action,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        ip: entry.ip ?? null,
        meta: entry.meta ? JSON.stringify(entry.meta) : null,
      });
    } catch (err) {
      this.logger.error(
        { err, action: entry.action, actorLabel: entry.actorLabel },
        "Failed to write audit log",
      );
    }
  }

  /**
   * Helper for settings.update: redacts the value field when the key
   * looks sensitive (password / token / secret / apiKey).
   */
  static redactSettingMeta(
    key: string,
    oldValue: string | undefined,
    newValue: string,
  ): Record<string, unknown> {
    const isSensitive = SENSITIVE_KEY_PATTERNS.some((re) => re.test(key));
    if (isSensitive) return { valueRedacted: true };
    return { oldValue: oldValue ?? null, newValue };
  }

  query(params: AuditQueryParams): AuditEntryRow[] {
    const where: string[] = [];
    const bind: Record<string, unknown> = {};

    if (params.actorUserId) {
      where.push("actor_user_id = @actorUserId");
      bind.actorUserId = params.actorUserId;
    }
    if (params.actionPrefix) {
      where.push("action LIKE @actionPrefix");
      bind.actionPrefix = `${params.actionPrefix}%`;
    }
    if (params.since) {
      where.push("timestamp >= @since");
      bind.since = params.since;
    }
    if (params.until) {
      where.push("timestamp <= @until");
      bind.until = params.until;
    }

    const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = params.offset ?? 0;

    const sql =
      this.stmts.queryBase +
      (where.length ? " WHERE " + where.join(" AND ") : "") +
      " ORDER BY timestamp DESC LIMIT @limit OFFSET @offset";

    const rows = this.db.prepare(sql).all({ ...bind, limit, offset }) as Array<{
      id: string;
      timestamp: string;
      actor_kind: string;
      actor_user_id: string | null;
      actor_label: string;
      action: string;
      target_type: string | null;
      target_id: string | null;
      ip: string | null;
      meta: string | null;
    }>;

    return rows.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      actorKind: r.actor_kind as AuditEntry["actorKind"],
      actorUserId: r.actor_user_id,
      actorLabel: r.actor_label,
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      ip: r.ip,
      meta: r.meta ? (JSON.parse(r.meta) as Record<string, unknown>) : null,
    }));
  }

  /** Delete entries older than `days`. Returns the number of rows deleted. */
  purgeOlderThan(days: number = RETENTION_DAYS): number {
    const before = this.stmts.count.get() as { n: number };
    this.stmts.purge.run(days);
    const after = this.stmts.count.get() as { n: number };
    return before.n - after.n;
  }
}
```

Decisions:

- **Never throws**: an audit miss is a degraded but acceptable outcome,
  a failed business operation because of audit is not. Mirrors the
  spec 111 stance of "logging is best-effort".
- **`randomUUID` + ISO 8601 timestamp** computed in Node, not via
  SQLite defaults, so we control format precisely and tests don't
  depend on `datetime('now')` clock skew.
- **`redactSettingMeta` is a static helper** so routes (not the
  logger) decide which payload shape to send. Keeps the logger
  domain-agnostic.
- **Query LIKE prefix**: `actionPrefix = "auth."` matches every
  `auth.*`. Indexed on `action` so this stays cheap.
- **Pagination caps**: 500 hard max to avoid DoS via huge offsets.

## Fastify wiring

`src/api/server.ts` decorates the app instance with the audit logger:

```ts
// inside createServer(deps)
app.decorate("audit", deps.auditLogger);
```

Route registrars accept `app.audit` (typed via Fastify module
augmentation in `src/api/types.ts` or inline). At each security-
sensitive call site:

```ts
// excerpt of src/api/routes/auth.ts
app.post("/api/v1/auth/login", async (request, reply) => {
  const { username, password } = request.body;
  try {
    const tokens = await authService.login(username, password);
    const user = userManager.getByUsername(username);
    app.audit.log({
      actorKind: "user",
      actorUserId: user?.id ?? null,
      actorLabel: username,
      action: "auth.login.success",
      targetType: "user",
      targetId: user?.id ?? null,
      ip: request.ip,
    });
    return tokens;
  } catch (err) {
    app.audit.log({
      actorKind: "user",
      actorLabel: username,
      action: "auth.login.failure",
      ip: request.ip,
      meta: { reason: err instanceof Error ? err.message : "unknown" },
    });
    throw err;
  }
});
```

Pattern is identical at every call site: build the entry, call
`log()`, return. The call is fire-and-forget at the route level (the
logger swallows its own errors).

## Boot wiring

In `src/index.ts`, right after the SettingsManager / UserManager block
and before the API server starts:

```ts
const auditLogger = new AuditLogger(db, logger);
const purged = auditLogger.purgeOlderThan(365);
if (purged > 0) {
  logger.info({ purged }, "Audit log retention purge complete");
}
```

Then `auditLogger` is included in the `createServer` deps.

The purge is one DELETE statement on a single indexed column — sub-
millisecond on any realistic DB size (a year of normal usage is
thousands, not millions, of rows).

## Admin endpoint

`src/api/routes/audit.ts`:

```ts
export function registerAuditRoutes(app: FastifyInstance): void {
  app.get<{
    Querystring: AuditQueryParams;
  }>(
    "/api/v1/audit",
    {
      preHandler: requireRole("admin"),
    },
    async (request) => {
      return {
        entries: app.audit.query(request.query),
      };
    },
  );
}
```

Authentication and admin role check go through the existing
`requireRole("admin")` middleware (same one as user management
routes). No new auth surface, no new role.

## Tests

Unit tests in `src/core/audit-logger.test.ts` cover the logger's
public API on an in-memory SQLite DB:

1. `log()` inserts a row with the correct fields
2. `log()` survives a thrown insert and logs an error to pino
3. `query()` filters by actor / action prefix / since / until
4. `query()` paginates with limit + offset
5. `query()` caps limit at MAX_LIMIT
6. `purgeOlderThan(N)` deletes rows older than N days, keeps newer
7. `redactSettingMeta()` redacts sensitive keys, exposes non-sensitive
8. JSON round-trip of `meta` through `log()` and `query()` preserves
   structure

Integration test of the API endpoint is deferred to the test plan
(see `plan.md`): we exercise one wire point (auth.login) end-to-end
via a Fastify inject() test, confirming the `audit_log` row lands in
the DB and that `GET /api/v1/audit` returns it.

## What this does not cover

Mirrored from spec.md for the implementer's eyes:

- Internal mutations not behind a route handler. Plugins writing to
  their own settings prefix do not produce audit entries — by design,
  to keep the trail meaningful.
- Tampering: anyone with file-level access to `data/sowel.db` can
  edit or wipe `audit_log`. Detection of post-hoc tampering would
  need a separate hardening spec.
- External SIEM / Splunk forwarding. Out of scope.
- UI display of the trail. Endpoint is in place; UI is a future spec.
