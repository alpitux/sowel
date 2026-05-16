import type { FastifyInstance } from "fastify";
import type { Logger } from "../../core/logger.js";
import type { ActivityBuffer } from "../../activity/activity-buffer.js";

interface ActivityDeps {
  activityBuffer: ActivityBuffer;
  logger: Logger;
}

export function registerActivityRoutes(app: FastifyInstance, deps: ActivityDeps): void {
  const { activityBuffer } = deps;

  // GET /api/v1/activity — Recent activity items, optionally scoped by zone
  app.get<{
    Querystring: {
      zoneId?: string;
      includeDescendants?: string;
      limit?: string;
    };
  }>("/api/v1/activity", async (request) => {
    const { zoneId, includeDescendants, limit } = request.query;
    const parsedLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
    const parsedIncludeDescendants = includeDescendants !== "false";

    const items = activityBuffer.getItems({
      zoneId: zoneId ?? null,
      includeDescendants: parsedIncludeDescendants,
      limit: parsedLimit,
    });

    return { items };
  });
}
