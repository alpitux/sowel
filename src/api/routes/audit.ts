import type { FastifyInstance } from "fastify";
import type { AuditLogger } from "../../core/audit-logger.js";
import type { Logger } from "../../core/logger.js";
import type { AuditQueryParams } from "../../shared/types.js";
import { requireAdmin } from "../../auth/auth-middleware.js";

// Spec 113 — Admin-only paginated query endpoint over the audit log.

interface AuditDeps {
  auditLogger: AuditLogger;
  logger: Logger;
}

export function registerAuditRoutes(app: FastifyInstance, deps: AuditDeps): void {
  const { auditLogger } = deps;

  // GET /api/v1/audit?actorUserId=&actionPrefix=&since=&until=&limit=&offset=
  app.get<{
    Querystring: {
      actorUserId?: string;
      actionPrefix?: string;
      since?: string;
      until?: string;
      limit?: string;
      offset?: string;
    };
  }>("/api/v1/audit", async (request, reply) => {
    requireAdmin(request, reply);
    if (reply.sent) return;

    const q = request.query;
    const params: AuditQueryParams = {
      actorUserId: q.actorUserId,
      actionPrefix: q.actionPrefix,
      since: q.since,
      until: q.until,
      limit: q.limit ? parseInt(q.limit, 10) : undefined,
      offset: q.offset ? parseInt(q.offset, 10) : undefined,
    };
    return { entries: auditLogger.query(params) };
  });
}
