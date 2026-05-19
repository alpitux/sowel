import type { FastifyInstance } from "fastify";
import type { Logger } from "../../core/logger.js";
import type { EventBus } from "../../core/event-bus.js";
import type { SettingsManager } from "../../core/settings-manager.js";
import { AuditLogger } from "../../core/audit-logger.js";
import type { UserManager } from "../../auth/user-manager.js";
import { buildActor } from "../audit-context.js";

interface SettingsDeps {
  settingsManager: SettingsManager;
  eventBus: EventBus;
  auditLogger: AuditLogger;
  userManager: UserManager;
  logger: Logger;
}

export function registerSettingsRoutes(app: FastifyInstance, deps: SettingsDeps): void {
  const { settingsManager, eventBus, auditLogger, userManager, logger: parentLogger } = deps;
  const logger = parentLogger.child({ module: "settings-routes" });

  // GET /api/v1/settings — Get all settings (admin only)
  app.get("/api/v1/settings", async (request, reply) => {
    if (!request.auth || request.auth.role !== "admin") {
      return reply.code(403).send({ error: "Admin access required" });
    }

    return settingsManager.getAll();
  });

  // PUT /api/v1/settings — Update settings (admin only)
  app.put<{ Body: Record<string, string> }>("/api/v1/settings", async (request, reply) => {
    if (!request.auth || request.auth.role !== "admin") {
      return reply.code(403).send({ error: "Admin access required" });
    }

    const entries = request.body;
    if (!entries || typeof entries !== "object") {
      return reply.code(400).send({ error: "Body must be a key-value object" });
    }

    // Validate all values are strings
    for (const [key, value] of Object.entries(entries)) {
      if (typeof key !== "string" || typeof value !== "string") {
        return reply.code(400).send({ error: `Invalid entry: ${key}` });
      }
    }

    // Capture old values BEFORE the write for the audit meta
    const oldValues: Record<string, string | undefined> = {};
    for (const k of Object.keys(entries)) oldValues[k] = settingsManager.get(k);

    settingsManager.setMany(entries);
    const keys = Object.keys(entries);
    logger.info({ keys }, "Settings updated");
    eventBus.emit({ type: "settings.changed", keys });

    // Audit one entry per changed key (spec 113).
    const actor = buildActor(request, userManager);
    for (const [key, newValue] of Object.entries(entries)) {
      auditLogger.log({
        ...actor,
        action: "settings.update",
        targetType: "settings",
        targetId: key,
        ip: request.ip,
        meta: AuditLogger.redactSettingMeta(key, oldValues[key], newValue),
      });
    }

    // Home location changed → timezone may need to be re-derived via restart
    if (keys.includes("home.latitude") || keys.includes("home.longitude")) {
      logger.warn("Home location changed. Restart Sowel for timezone changes to apply.");
      eventBus.emit({
        type: "system.restart_required",
        reason: "home_location_changed",
      });
    }

    return { success: true };
  });
}
