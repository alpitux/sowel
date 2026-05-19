import type { FastifyInstance } from "fastify";
import type { AuthService } from "../../auth/auth-service.js";
import { AuthError } from "../../auth/auth-service.js";
import type { UserManager } from "../../auth/user-manager.js";
import type { Logger } from "../../core/logger.js";
import type { AuditLogger } from "../../core/audit-logger.js";

interface AuthDeps {
  authService: AuthService;
  userManager: UserManager;
  auditLogger: AuditLogger;
  logger: Logger;
}

export function registerAuthRoutes(app: FastifyInstance, deps: AuthDeps): void {
  const { authService, userManager, auditLogger } = deps;

  // GET /api/v1/auth/status — Check if setup is required
  app.get("/api/v1/auth/status", async () => {
    return { setupRequired: !userManager.hasUsers() };
  });

  // POST /api/v1/auth/setup — Create first admin user (first-run only)
  app.post<{
    Body: { username: string; password: string; displayName: string; language?: "fr" | "en" };
  }>("/api/v1/auth/setup", async (request, reply) => {
    if (userManager.hasUsers()) {
      return reply.code(403).send({ error: "Setup already completed" });
    }

    const { username, password, displayName, language } = request.body ?? {};
    if (!username || !password || !displayName) {
      return reply.code(400).send({ error: "username, password, and displayName are required" });
    }
    if (password.length < 6) {
      return reply.code(400).send({ error: "Password must be at least 6 characters" });
    }

    await userManager.createUser({
      username,
      password,
      displayName,
      role: "admin",
      preferences: { language: language ?? "fr" },
    });

    // Auto-login after setup
    const tokens = await authService.login(username, password);
    return reply.code(201).send(tokens);
  });

  // POST /api/v1/auth/login (stricter rate limit: 10 req/min)
  app.post<{
    Body: { username: string; password: string };
  }>(
    "/api/v1/auth/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { username, password } = request.body ?? {};
      if (!username || !password) {
        return reply.code(400).send({ error: "username and password are required" });
      }

      try {
        const tokens = await authService.login(username, password);
        const user = userManager.getByUsername(username);
        auditLogger.log({
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
        auditLogger.log({
          actorKind: "user",
          actorLabel: username,
          action: "auth.login.failure",
          ip: request.ip,
          meta: { reason: err instanceof Error ? err.message : "unknown" },
        });
        if (err instanceof AuthError) {
          return reply.code(err.status).send({ error: err.message });
        }
        throw err;
      }
    },
  );

  // POST /api/v1/auth/refresh
  app.post<{
    Body: { refreshToken: string };
  }>("/api/v1/auth/refresh", async (request, reply) => {
    const { refreshToken } = request.body ?? {};
    if (!refreshToken) {
      return reply.code(400).send({ error: "refreshToken is required" });
    }

    try {
      const tokens = await authService.refresh(refreshToken);
      return tokens;
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.code(err.status).send({ error: err.message });
      }
      throw err;
    }
  });

  // POST /api/v1/auth/logout
  app.post<{
    Body: { refreshToken: string };
  }>("/api/v1/auth/logout", async (request, reply) => {
    const { refreshToken } = request.body ?? {};
    if (refreshToken) {
      authService.logout(refreshToken);
    }
    if (request.auth) {
      const user = userManager.getById(request.auth.userId);
      auditLogger.log({
        actorKind: request.tokenKind === "api_token" ? "api_token" : "user",
        actorUserId: request.auth.userId,
        actorLabel: user?.username ?? request.auth.userId,
        action: "auth.logout",
        ip: request.ip,
      });
    }
    return reply.code(204).send();
  });
}
