import type { PluginDeps } from "../../shared/plugin-api.js";
import type { IntegrationPlugin } from "../../integrations/integration-registry.js";

// Spec 111 canary plugin. Intentionally tries every violation the Proxy
// is meant to block, captures the outcome of each attempt for assertion
// in the integration test, and (deliberately) throws inside refresh() to
// exercise the error-confinement wrapper.

export interface CanaryAttempts {
  stolenToken?: string;
  foreignWrite?: "no-throw" | "threw";
  foreignDevice?: "no-throw" | "threw";
  foreignUpsert?: "no-throw" | "threw";
  adminUpdate?: "no-throw" | "threw";
}

export const CANARY_ID = "canary";

export function createCanaryPlugin(deps: PluginDeps, attempts: CanaryAttempts): IntegrationPlugin {
  return {
    id: CANARY_ID,
    name: "Canary",
    description: "Deliberate-violation test plugin (spec 111)",
    icon: "Bug",
    getStatus: () => "connected",
    isConfigured: () => true,
    getSettingsSchema: () => [],
    async start(): Promise<void> {
      // (1) Foreign read — should return undefined, never the real secret
      attempts.stolenToken = deps.settingsManager.get("integration.netatmo.refresh_token");

      // (2) Foreign write — should throw
      try {
        deps.settingsManager.set("integration.netatmo.evil", "x");
        attempts.foreignWrite = "no-throw";
      } catch {
        attempts.foreignWrite = "threw";
      }

      // (3) Forbidden emit type — should be silently dropped
      // Cast through unknown because TS knows it's not a valid EngineEvent;
      // that's exactly what we're testing the runtime guard for.
      deps.eventBus.emit({
        type: "equipment.data.changed",
        equipmentId: "fake",
      } as unknown as Parameters<typeof deps.eventBus.emit>[0]);

      // (4) Impersonation — should be silently dropped
      deps.eventBus.emit({
        type: "system.integration.connected",
        integrationId: "netatmo",
      });

      // (5) Foreign device mutation — should throw
      try {
        deps.deviceManager.updateDeviceData("netatmo", "fake-source-id", { key: "value" });
        attempts.foreignDevice = "no-throw";
      } catch {
        attempts.foreignDevice = "threw";
      }

      // (6) Foreign upsertFromDiscovery — should throw
      try {
        deps.deviceManager.upsertFromDiscovery("netatmo", "netatmo_hc", {
          friendlyName: "Pwned",
          data: [],
          orders: [],
        });
        attempts.foreignUpsert = "no-throw";
      } catch {
        attempts.foreignUpsert = "threw";
      }

      // (7) Admin mutation — should throw
      try {
        deps.deviceManager.update("some-id", { name: "renamed" });
        attempts.adminUpdate = "no-throw";
      } catch {
        attempts.adminUpdate = "threw";
      }
    },
    async stop(): Promise<void> {},
    async executeOrder(): Promise<void> {},
    async refresh(): Promise<void> {
      // Deliberately throw — the wrapper should swallow this without
      // tearing down the core.
      throw new Error("canary refresh boom");
    },
  };
}
