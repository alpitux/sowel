# Spec 111 — Plugin soft isolation via scoped Proxy

> Defensive hardening of the plugin runtime. No new user-facing feature,
> no breaking change for plugin authors. The `PluginDeps` contract stays
> identical at the type level; only the concrete objects passed at load
> time become scoped Proxies.

## Problem

Since spec 053 every integration and every recipe is distributed as an
external plugin from GitHub. Spec 089 closed the supply chain (SHA256
verification, `OFFICIAL_OWNERS` whitelist, community confirmation modal)
so an attacker cannot silently swap a tarball.

Once a plugin is loaded, however, it runs with **full access to the
Sowel core**. The `PluginDeps` exposed in
[src/shared/plugin-api.ts](src/shared/plugin-api.ts) hands every plugin
the real `eventBus`, `settingsManager` and `deviceManager`. Concretely
that means any plugin (legitimate, buggy, or compromised) can:

- Read every other plugin's settings via
  `settingsManager.getByPrefix("integration.")`. That includes Netatmo
  refresh tokens, Panasonic Cloud passwords, Telegram bot tokens, MQTT
  credentials.
- Write to any settings key, including those of other plugins or core
  config.
- Emit arbitrary `EngineEvent`s, including domain events like
  `equipment.data.changed` or `zone.data.changed` it has no business
  producing, and impersonate another integration via a forged
  `integrationId` field.
- Mutate devices belonging to other integrations through
  `deviceManager.upsertFromDiscovery({ integrationId: "netatmo", ... })`
  even when called from a different plugin.
- Throw an unhandled exception in a callback or `setInterval` and tear
  down the entire Sowel process (no `uncaughtException` handler today,
  see audit F03).

The threat model is realistic today even without considering malicious
authors: a buggy plugin that crashes on a stale token, or a community
plugin that mistakenly reads a global key, breaks Sowel-wide. The
threat model gets worse once spec 103 opens the registry to external
contributors beyond `OFFICIAL_OWNERS = ["mchacher"]`.

Hard isolation (worker threads, separate processes) would force a
plugin API v2: every `eventBus.emit` and `deviceManager.update*` call
becomes async message passing, every object must be serializable, every
existing plugin must be rewritten. The ecosystem cost is prohibitive
for the threat at hand.

## Goal

Wrap every dependency the plugin loader hands out in a **scoped Proxy**
that enforces three invariants:

1. **Settings scoping**: a plugin can only read and write keys under
   `integration.<own-id>.` plus an explicit allowlist of global keys
   (`home.latitude`, `home.longitude`, `home.timezone`).
2. **Event integrity**: a plugin can only emit events from a small
   whitelist of `system.*` types, and cannot impersonate another
   integration by forging `integrationId`.
3. **Device ownership**: every `deviceManager.update*` /
   `upsertFromDiscovery` / `removeStaleDevices` call is forced to the
   caller's plugin id; cross-integration mutation is rejected.

And one error containment invariant:

4. **Error confinement**: throws inside `IntegrationPlugin.refresh()`,
   `getStatus()`, `getSettingsSchema()`, `isConfigured()` and similar
   methods stay inside the plugin, log with `pluginId` context, and
   never propagate to the core event loop. Throws inside `start`,
   `stop`, `executeOrder`, `handleOAuthCallback` still rethrow because
   callers (recipe engine, UI, OAuth flow) need to know.

The PluginDeps TypeScript surface stays bit-for-bit identical, so **no
existing plugin needs source changes**. All 13 integration plugins plus
all recipe plugins keep working unmodified.

## Non-goals

This spec deliberately does not address:

- **Hard isolation** (worker_threads / IPC). That is a future spec
  111b when the registry grows past trusted owners.
- **Filesystem sandboxing**: a plugin can still `import("better-sqlite3")`
  and open `data/sowel.db` directly, or read `process.env`. Mitigation
  is OS-level (Docker user separation), not in scope here.
- **Network sandboxing**: a plugin can still `fetch()` any URL. Same
  rationale.
- **Prototype pollution defense**: out of scope.
- **`process.exit()` from a plugin**: not blocked. Documented as a
  known limit.
- **The settings-at-rest encryption** (audit F01): orthogonal concern,
  accepted as-is per audit § 1.4.

## Approach

Add a new module `src/plugins/scoped-deps.ts` that exports three
factories: `makeSettingsManagerProxy`, `makeEventBusProxy`,
`makeDeviceManagerProxy`. Each takes the plugin id, the real dependency,
and a logger, and returns an object that implements the same interface
but enforces the invariants above.

Modify [src/plugins/plugin-loader.ts](src/plugins/plugin-loader.ts)
`loadPlugin()` to build a `ScopedPluginDeps` from the real
`PluginDeps` before calling the plugin factory. The plugin observes no
difference at the API level.

Add a `wrapPluginMethods()` helper in the same file that wraps the
returned `IntegrationPlugin`'s async methods so a throw never escapes
without being logged with `pluginId` context.

Ship behind a feature flag (`SOWEL_PLUGIN_ISOLATION` env var, default
on after one beta cycle) so we can disable in production within
minutes if any unforeseen plugin breaks.

Document the new contract in `docs/technical/plugin-development.md` and
add a note in CLAUDE.md so future agents and contributors understand
the scoping rules when writing new plugins.

## Acceptance criteria

A plugin that today calls
`settingsManager.getByPrefix("integration.netatmo.")` from inside the
zigbee2mqtt plugin must:

- receive an empty object back instead of the real Netatmo settings
- a `warn` line is emitted with `{ pluginId: "zigbee2mqtt", prefix:
"integration.netatmo." }`

A plugin that today calls
`eventBus.emit({ type: "equipment.data.changed", ... })` must:

- the emit is silently dropped (no propagation)
- a `warn` line is emitted with `{ pluginId, eventType }`

A plugin that today throws in `refresh()`:

- the throw is caught, logged with `{ err, pluginId, method: "refresh" }`
- Sowel keeps running, other plugins keep working

A plugin that today calls
`deviceManager.upsertFromDiscovery({ integrationId: "panasonic-cc", ... })`
from the zigbee2mqtt plugin:

- the call succeeds but writes a device with
  `integrationId: "zigbee2mqtt"` (forced by Proxy), or
- equivalently, a thrown error if we choose the strict path

All 13 existing integration plugins keep working in their current
versions without source modification. Validated by booting Sowel with
`SOWEL_PLUGIN_ISOLATION=true` and reviewing logs for warns over a
72h period.

## Out of scope but worth recording

The list of `ALLOWED_EMIT_TYPES` and `GLOBAL_READABLE_KEYS` is defined
statically in `scoped-deps.ts`. A cleaner long-term option is to move
both lists to the plugin manifest (`requiredGlobalReads`,
`emitsEventTypes`). That migration is a follow-up (spec 111c).

**Recipes are out of scope.** Phase 1 recon confirmed that
`RecipeFactory = () => RecipeDefinition` takes no deps. Recipe packages
return pure declarative definitions; their behavior is executed by the
core `recipe-manager.ts` which holds the real `EquipmentManager`
reference. A recipe package cannot reach `SettingsManager`,
`DeviceManager` or `EventBus` directly. Recipes are therefore already
safe from the F02 threat model by their declarative design, and need
no Proxy wrapping.
