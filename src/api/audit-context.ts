import type { FastifyRequest } from "fastify";
import type { UserManager } from "../auth/user-manager.js";
import type { AuditEntry } from "../shared/types.js";

// Spec 113 — Build the actor portion of an audit entry from a
// Fastify request. Looks up the username via UserManager so the
// `actorLabel` is human-readable instead of just a UUID.

export interface AuditActor {
  actorKind: AuditEntry["actorKind"];
  actorUserId: string | null;
  actorLabel: string;
}

export function buildActor(request: FastifyRequest, userManager: UserManager): AuditActor {
  if (!request.auth) {
    return { actorKind: "system", actorUserId: null, actorLabel: "system" };
  }
  const user = userManager.getById(request.auth.userId);
  return {
    actorKind: request.tokenKind === "api_token" ? "api_token" : "user",
    actorUserId: request.auth.userId,
    actorLabel: user?.username ?? request.auth.userId,
  };
}
