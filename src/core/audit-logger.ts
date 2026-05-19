import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { Logger } from "./logger.js";
import type { AuditEntry, AuditEntryRow, AuditQueryParams } from "../shared/types.js";

// Spec 113 — Audit log persistence service.
//
// Writes one row per security-sensitive action (auth, user CRUD,
// settings, mode, backup, plugin install). Read back via paginated
// admin queries. The logger NEVER throws: a DB failure is logged
// through pino and the underlying business operation continues.

const SENSITIVE_KEY_PATTERNS: RegExp[] = [/password/i, /token/i, /secret/i, /api_?key/i];

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
export const DEFAULT_RETENTION_DAYS = 365;

interface AuditRow {
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
}

export class AuditLogger {
  private db: Database.Database;
  private logger: Logger;
  private insertStmt: Database.Statement;
  private purgeStmt: Database.Statement;
  private countStmt: Database.Statement;

  constructor(db: Database.Database, logger: Logger) {
    this.db = db;
    this.logger = logger.child({ module: "audit-logger" });
    this.insertStmt = db.prepare(
      `INSERT INTO audit_log
        (id, timestamp, actor_kind, actor_user_id, actor_label, action,
         target_type, target_id, ip, meta)
       VALUES (@id, @timestamp, @actorKind, @actorUserId, @actorLabel, @action,
               @targetType, @targetId, @ip, @meta)`,
    );
    this.purgeStmt = db.prepare(
      "DELETE FROM audit_log WHERE timestamp < datetime('now', '-' || ? || ' days')",
    );
    this.countStmt = db.prepare("SELECT COUNT(*) AS n FROM audit_log");
  }

  /**
   * Persist an audit entry. NEVER throws. Failures are logged through
   * pino at error level so the caller can continue without branching.
   */
  log(entry: AuditEntry): void {
    try {
      this.insertStmt.run({
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
   * Build the meta payload for a `settings.update` audit entry,
   * redacting the value when the key matches one of the sensitive
   * patterns (password, token, secret, apiKey).
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
    bind.limit = limit;
    bind.offset = offset;

    const sql =
      "SELECT id, timestamp, actor_kind, actor_user_id, actor_label, action," +
      " target_type, target_id, ip, meta FROM audit_log" +
      (where.length > 0 ? " WHERE " + where.join(" AND ") : "") +
      " ORDER BY timestamp DESC LIMIT @limit OFFSET @offset";

    const rows = this.db.prepare(sql).all(bind) as AuditRow[];

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

  /**
   * Delete entries older than `days`. Returns the number of rows
   * removed. Called at boot from `src/index.ts` with 365 days.
   */
  purgeOlderThan(days: number = DEFAULT_RETENTION_DAYS): number {
    const before = (this.countStmt.get() as { n: number }).n;
    this.purgeStmt.run(days);
    const after = (this.countStmt.get() as { n: number }).n;
    return before - after;
  }
}
