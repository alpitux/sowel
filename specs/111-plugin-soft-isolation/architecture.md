# Spec 111 — Architecture

Scoped Proxy on `PluginDeps` plus a thin wrapper around the returned
`IntegrationPlugin` methods. No new tables, no new event types, no
schema migration, no UI change. Pure runtime hardening.

## Files touched

| File                                                         | Change                                                                                                          |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `src/plugins/scoped-deps.ts`                                 | **New**. Three Proxy factories + `wrapPluginMethods` + constants `ALLOWED_EMIT_TYPES`, `GLOBAL_READABLE_KEYS`   |
| `src/plugins/scoped-deps.test.ts`                            | **New**. Unit tests for the four invariants                                                                     |
| [src/plugins/plugin-loader.ts](src/plugins/plugin-loader.ts) | `loadPlugin()` builds scoped deps; result of `factory(deps)` goes through `wrapPluginMethods` before `register` |
| `src/config.ts`                                              | Add `SOWEL_PLUGIN_ISOLATION` env flag (default `true` after beta)                                               |
| `docs/technical/plugin-development.md` + `.fr.md`            | New "Plugin scoping" section explaining the invariants                                                          |
| `CLAUDE.md`                                                  | New "Plugin soft isolation (spec 111)" note for future agents                                                   |
| `docs/audit/2026-05-19-architectural.md`                     | Mark F02 as mitigated by spec 111 (note in § 1.4 or new § 1.5)                                                  |
| `docs/specs-index.md` + `.fr.md`                             | Add spec 111 entry                                                                                              |

Recipes are NOT in scope (confirmed in Phase 1 recon).
`RecipeFactory = () => RecipeDefinition` takes no deps, so no Proxy
is needed on the recipe side.

## Invariants and the code that enforces them

### Invariant 1 — Settings scoping

```ts
// src/plugins/scoped-deps.ts (excerpt)

const GLOBAL_READABLE_KEYS: ReadonlySet<string> = new Set([
  "home.latitude",
  "home.longitude",
  "home.timezone",
]);

export function makeSettingsManagerProxy(
  pluginId: string,
  inner: SettingsManager,
  logger: Logger,
): SettingsManager {
  const ownPrefix = `integration.${pluginId}.`;
  const isOwn = (k: string) => k.startsWith(ownPrefix);
  const isGlobalReadable = (k: string) => GLOBAL_READABLE_KEYS.has(k);

  const scoped: SettingsManager = Object.create(SettingsManager.prototype);

  scoped.get = (key) => {
    if (isOwn(key) || isGlobalReadable(key)) return inner.get(key);
    logger.warn({ pluginId, key }, "Plugin denied read on foreign setting");
    return undefined;
  };

  scoped.set = (key, value) => {
    if (isOwn(key)) return inner.set(key, value);
    logger.warn({ pluginId, key }, "Plugin denied write on foreign setting");
    throw new Error(`Plugin "${pluginId}" cannot write key "${key}"`);
  };

  scoped.setMany = (entries) => {
    const violations = Object.keys(entries).filter((k) => !isOwn(k));
    if (violations.length > 0) {
      logger.warn({ pluginId, keys: violations }, "Plugin denied bulk write");
      throw new Error(`Plugin "${pluginId}" attempted foreign setMany`);
    }
    return inner.setMany(entries);
  };

  scoped.getAll = () => {
    logger.warn({ pluginId }, "Plugin denied getAll");
    return {};
  };

  scoped.getByPrefix = (prefix) => {
    if (prefix.startsWith(ownPrefix)) return inner.getByPrefix(prefix);
    logger.warn({ pluginId, prefix }, "Plugin denied getByPrefix on foreign prefix");
    return {};
  };

  // zigbee2mqtt-specific helpers restricted to that plugin
  scoped.isMqttConfigured = inner.isMqttConfigured.bind(inner);
  scoped.getMqttConfig = () => {
    if (pluginId !== "zigbee2mqtt") {
      logger.warn({ pluginId }, "Non-zigbee2mqtt plugin called getMqttConfig");
      throw new Error("getMqttConfig is restricted to zigbee2mqtt");
    }
    return inner.getMqttConfig();
  };
  scoped.getZ2mConfig = () => {
    if (pluginId !== "zigbee2mqtt") {
      throw new Error("getZ2mConfig is restricted to zigbee2mqtt");
    }
    return inner.getZ2mConfig();
  };

  return scoped;
}
```

Decisions:

- **Read on foreign key**: silent `undefined` plus `warn`. Same shape
  as if the key did not exist, so a polite plugin querying optional
  keys is unaffected and a malicious one gets nothing.
- **Write on foreign key**: throw. Writes are always intentional;
  silencing them would create ghosts.
- **`getMqttConfig` / `getZ2mConfig`**: kept on the API for backward
  compatibility, restricted to their owning plugin. A clean refactor
  would move them inside the zigbee2mqtt plugin's own settings, out
  of scope here.

### Invariant 2 — Event integrity

```ts
const ALLOWED_EMIT_TYPES: ReadonlySet<EngineEvent["type"]> = new Set([
  "system.integration.connected",
  "system.integration.disconnected",
  "system.alarm.raised",
  "system.alarm.resolved",
]);

export function makeEventBusProxy(pluginId: string, inner: EventBus, logger: Logger): EventBus {
  const scoped: EventBus = Object.create(EventBus.prototype);

  scoped.emit = (event) => {
    if (!ALLOWED_EMIT_TYPES.has(event.type)) {
      logger.warn(
        { pluginId, eventType: event.type },
        "Plugin emit denied (type not in allowlist)",
      );
      return;
    }
    if (
      "integrationId" in event &&
      (event as { integrationId: string }).integrationId !== pluginId
    ) {
      logger.warn(
        {
          pluginId,
          claimed: (event as { integrationId: string }).integrationId,
          eventType: event.type,
        },
        "Plugin emit denied (integrationId impersonation)",
      );
      return;
    }
    return inner.emit(event);
  };

  // Subscriptions left open for now; logged at debug for audit
  scoped.on = (handler) => {
    logger.debug({ pluginId }, "Plugin subscribed to all events");
    return inner.on(handler);
  };
  scoped.onType = (type, handler) => {
    logger.debug({ pluginId, eventType: type }, "Plugin subscribed to event type");
    return inner.onType(type, handler);
  };

  return scoped;
}
```

Decisions:

- The four allowed types are derived from the audit of all 13 plugins
  in the registry (none emit domain events). Adding a new type to the
  allowlist is a code change reviewed at PR time.
- **Forbidden emit is silently dropped** rather than thrown, to avoid
  a single legacy `emit` accidentally taking down a plugin's loop. The
  warn line is enough to drive the fix.

### Invariant 3 — Device ownership

```ts
export function makeDeviceManagerProxy(
  pluginId: string,
  inner: DeviceManager,
  logger: Logger,
): DeviceManager {
  const scoped: DeviceManager = Object.create(DeviceManager.prototype);

  scoped.upsertFromDiscovery = (integrationId, source, discovered) => {
    if (integrationId !== pluginId) {
      logger.warn(
        { pluginId, integrationId },
        "Plugin denied upsertFromDiscovery on foreign integration",
      );
      throw new Error(`Plugin "${pluginId}" cannot upsertFromDiscovery on "${integrationId}"`);
    }
    return inner.upsertFromDiscovery(pluginId, source, discovered);
  };

  scoped.updateDeviceData = (integrationId, sourceDeviceId, payload, sourceTimestamp) => {
    if (integrationId !== pluginId) {
      logger.warn(
        { pluginId, integrationId },
        "Plugin denied updateDeviceData on foreign integration",
      );
      throw new Error(`Plugin "${pluginId}" cannot updateDeviceData on "${integrationId}"`);
    }
    return inner.updateDeviceData(pluginId, sourceDeviceId, payload, sourceTimestamp);
  };

  scoped.updateDeviceStatus = (integrationId, sourceDeviceId, status) => {
    if (integrationId !== pluginId) {
      logger.warn(
        { pluginId, integrationId },
        "Plugin denied updateDeviceStatus on foreign integration",
      );
      throw new Error(`Plugin "${pluginId}" cannot updateDeviceStatus on "${integrationId}"`);
    }
    return inner.updateDeviceStatus(pluginId, sourceDeviceId, status);
  };

  scoped.markRemoved = (integrationId, sourceDeviceId) => {
    if (integrationId !== pluginId) {
      throw new Error(`Plugin "${pluginId}" cannot markRemoved on "${integrationId}"`);
    }
    return inner.markRemoved(pluginId, sourceDeviceId);
  };

  scoped.removeStaleDevices = (integrationId, activeDeviceIds) => {
    if (integrationId !== pluginId) {
      throw new Error(`Plugin "${pluginId}" cannot removeStaleDevices on "${integrationId}"`);
    }
    return inner.removeStaleDevices(pluginId, activeDeviceIds);
  };

  scoped.migrateIntegrationId = (oldId, newId, models) => {
    if (newId !== pluginId) {
      throw new Error(`Plugin "${pluginId}" can only migrate to own id (got "${newId}")`);
    }
    return inner.migrateIntegrationId(oldId, pluginId, models);
  };

  // Admin mutations (rename, delete, zone reassignment) are not exposed
  // to plugins. They are UI-driven actions on top of devices, not plugin
  // responsibilities.
  scoped.update = () => {
    logger.warn({ pluginId }, "Plugin denied DeviceManager.update (admin-only)");
    throw new Error(`Plugin "${pluginId}" cannot call DeviceManager.update`);
  };
  scoped.delete = () => {
    logger.warn({ pluginId }, "Plugin denied DeviceManager.delete (admin-only)");
    throw new Error(`Plugin "${pluginId}" cannot call DeviceManager.delete`);
  };

  // Read methods: kept open. A plugin reading a foreign device is rare but
  // legitimate (weather-forecast reading a station device). Logged at debug
  // so we can revisit if a tighter rule is needed.
  scoped.getDeviceDataValue = inner.getDeviceDataValue.bind(inner);
  scoped.logSummary = inner.logSummary.bind(inner);
  scoped.getAll = inner.getAll.bind(inner);
  scoped.getById = inner.getById.bind(inner);

  return scoped;
}
```

Decisions:

- `upsertFromDiscovery` **overrides** `integrationId` rather than
  throwing on mismatch. A plugin that passes the wrong id by mistake
  (copy-paste from another plugin) still works correctly. Malicious
  impersonation by spoofing `integrationId` becomes structurally
  impossible.
- All other mutations **throw** because they take `integrationId` as
  an explicit argument; the contract is unambiguous.
- Read methods are intentionally open. The pool plugin reads
  weather data, weather-forecast may read sensor stations. We
  document this as a known limit; tightening goes in spec 111c if
  needed.

### Invariant 4 — Error confinement

```ts
type AsyncMethod = (...args: unknown[]) => Promise<unknown>;

const RETHROW_METHODS = new Set(["start", "stop", "executeOrder", "handleOAuthCallback"]);

export function wrapPluginMethods(
  plugin: IntegrationPlugin,
  pluginId: string,
  logger: Logger,
): IntegrationPlugin {
  const wrapAsync =
    (name: string, fn: AsyncMethod): AsyncMethod =>
    async (...args) => {
      const start = performance.now();
      try {
        return await fn(...args);
      } catch (err) {
        logger.error({ err, pluginId, method: name }, "Plugin async method threw");
        if (RETHROW_METHODS.has(name)) throw err;
        return undefined;
      } finally {
        const ms = performance.now() - start;
        if (ms > 1000) logger.warn({ pluginId, method: name, ms }, "Slow plugin call");
      }
    };

  const wrapSync =
    <R>(name: string, fn: () => R, fallback: R): (() => R) =>
    () => {
      try {
        return fn();
      } catch (err) {
        logger.error({ err, pluginId, method: name }, "Plugin sync method threw");
        return fallback;
      }
    };

  return {
    ...plugin,
    start: wrapAsync("start", plugin.start.bind(plugin)) as IntegrationPlugin["start"],
    stop: wrapAsync("stop", plugin.stop.bind(plugin)) as IntegrationPlugin["stop"],
    executeOrder: wrapAsync(
      "executeOrder",
      plugin.executeOrder.bind(plugin),
    ) as IntegrationPlugin["executeOrder"],
    refresh: plugin.refresh
      ? (wrapAsync("refresh", plugin.refresh.bind(plugin)) as IntegrationPlugin["refresh"])
      : undefined,
    handleOAuthCallback: plugin.handleOAuthCallback
      ? (wrapAsync(
          "handleOAuthCallback",
          plugin.handleOAuthCallback.bind(plugin),
        ) as IntegrationPlugin["handleOAuthCallback"])
      : undefined,
    getStatus: wrapSync("getStatus", plugin.getStatus.bind(plugin), "error" as const),
    isConfigured: wrapSync("isConfigured", plugin.isConfigured.bind(plugin), false),
    getSettingsSchema: wrapSync("getSettingsSchema", plugin.getSettingsSchema.bind(plugin), []),
    getPollingInfo: plugin.getPollingInfo
      ? wrapSync("getPollingInfo", plugin.getPollingInfo.bind(plugin), null)
      : undefined,
    getOAuthUrl: plugin.getOAuthUrl
      ? wrapSync("getOAuthUrl", plugin.getOAuthUrl.bind(plugin), null)
      : undefined,
  };
}
```

Decisions:

- `start`, `stop`, `executeOrder`, `handleOAuthCallback` rethrow because
  callers (registry start sequence, recipe engine order dispatcher,
  OAuth callback route) need the error to surface for retry, alerting,
  and HTTP status codes.
- All other methods swallow errors with a typed fallback (`"error"`,
  `false`, `[]`, `null`). The UI gets a degraded but stable view
  instead of a crash.
- Slow-call warning at 1s is a soft canary — easy to tune by env var
  later if we discover hot paths around it.

## Wiring into `plugin-loader.ts`

```ts
// src/plugins/plugin-loader.ts (modified excerpt — inside loadPlugin)

const deps: PluginDeps = {
  ...this.coreDeps,
  logger: this.coreDeps.logger.child({ module: `plugin:${pluginId}` }),
  pluginDir: pkgDir,
};

const scopedDeps: PluginDeps = config.pluginIsolation
  ? {
      logger: deps.logger,
      eventBus: makeEventBusProxy(pluginId, deps.eventBus, deps.logger),
      settingsManager: makeSettingsManagerProxy(pluginId, deps.settingsManager, deps.logger),
      deviceManager: makeDeviceManagerProxy(pluginId, deps.deviceManager, deps.logger),
      pluginDir: deps.pluginDir,
    }
  : deps;

// ... import factory as before ...
const rawPlugin = factory(scopedDeps);
const plugin = config.pluginIsolation
  ? wrapPluginMethods(rawPlugin, pluginId, deps.logger)
  : rawPlugin;

this.integrationRegistry.register(plugin);
```

The feature flag `config.pluginIsolation` defaults to `true` after one
beta cycle. The env var `SOWEL_PLUGIN_ISOLATION=false` allows emergency
disable in production without redeploy.

## Logging contract

Every Proxy denial emits a structured pino line:

```
{ level: "warn", pluginId, key|prefix|eventType|integrationId, msg: "Plugin denied <op>" }
```

This doubles as a free audit trail for plugin misbehavior, which the
audit doc tracks under F13 (audit trail). The denial lines are
recognizable from a single grep `'Plugin denied'` in `data/logs/`.

## What this does not protect

Mirrored from spec.md § "Non-goals" for the implementer's eyes:

- `import("better-sqlite3")` + direct DB open
- `process.env` read
- Infinite loops / OOM
- Prototype pollution (`Object.prototype.X = ...`)
- Arbitrary `fetch()` / `https.request()`
- `process.exit()` called by the plugin

These remain in the residual risk box. The roadmap toward worker-thread
isolation (spec 111b, hypothetical) is the only structural answer if
the registry grows past trusted authors.
