# Spec 111 — Implementation plan

Single feature branch `feat/plugin-soft-isolation`. Estimated effort:
**5.5 days dev** (0.5 recon + 2 core + 1.5 tests + 0.5 observation +
1 doc). No DB migration, no UI work, no breaking change for plugins.

## Tasks

### Phase 1 — Recon (DONE)

Recon completed before implementation kickoff. Findings:

- **Recipes are not in scope**: `RecipeFactory = () => RecipeDefinition`
  takes no deps. Recipes are pure declarative definitions executed by
  `recipe-manager.ts` in the core. No Proxy needed on the recipe side.
- **Plugin emit inventory confirmed**: greps over all 13
  `sowel-plugin-*/src/` repos showed only the four expected event types
  (`system.integration.connected`, `system.integration.disconnected`,
  `system.alarm.raised`, `system.alarm.resolved`). Legrand's "custom"
  emits at lines 591/602 of `legrand-control/src/index.ts` are
  `system.alarm.*`, already in `ALLOWED_EMIT_TYPES`.
- **Plugin settings inventory confirmed**: all 13 plugins use their own
  `integration.<id>.` prefix. Only `weather-forecast` reads globals
  (`home.latitude`, `home.longitude`) which are in `GLOBAL_READABLE_KEYS`.

### Phase 2 — Core implementation (2 days)

3. [ ] Create `src/plugins/scoped-deps.ts` with the four exports:
       `makeSettingsManagerProxy`, `makeEventBusProxy`,
       `makeDeviceManagerProxy`, `wrapPluginMethods`, plus the two const
       sets `ALLOWED_EMIT_TYPES` and `GLOBAL_READABLE_KEYS`. Match the
       shape in `architecture.md` exactly.
4. [ ] Add `pluginIsolation: boolean` to `src/config.ts`, defaulted
       from `process.env.SOWEL_PLUGIN_ISOLATION`. Default `false` for the
       first PR (opt-in dev), to be flipped to `true` in a later step.
5. [ ] Modify [src/plugins/plugin-loader.ts](src/plugins/plugin-loader.ts)
       `loadPlugin()`: build `scopedDeps` and `wrapPluginMethods` when the
       flag is on. Type-check: the scoped objects must satisfy the same
       `SettingsManager`/`EventBus`/`DeviceManager` interfaces (use
       `Object.create(SettingsManager.prototype)` or class-like wrappers
       to avoid `unknown` casts).
6. [ ] If recipes use the same wiring: apply the same in
       `src/recipes/recipe-loader.ts`. Otherwise create
       `src/recipes/scoped-deps.ts`.

### Phase 3 — Tests (1.5 day)

Three layers: unit on Proxies, integration with a deliberately
misbehaving canary plugin, structured logging assertions.

#### 3.1 Test helpers (0.25 day)

7. [ ] Create `src/plugins/__fixtures__/test-helpers.ts` with two reusable factories:
   - `makeMockLogger()` returns a logger with `warn`, `error`, `info`,
     `debug` as `vi.fn()` and a `child()` that returns itself (so
     scoped child loggers don't break the spy chain). Add a helper
     `expectWarn(logger, partial)` that asserts at least one `warn`
     call matches a partial object.
   - `makeMockSettingsManager()`, `makeMockEventBus()`,
     `makeMockDeviceManager()` returning minimal in-memory
     implementations with `vi.fn()` wrappers so we can assert "the
     inner method was/was not called".

#### 3.2 Unit tests on the Proxies (0.5 day)

8. [ ] Create `src/plugins/scoped-deps.test.ts` covering all four
       invariants. Every "deny" case must assert **both** the return value
       **and** that the inner real method was NOT called (the Proxy must
       short-circuit, not forward and filter).

   **SettingsManagerProxy** (8 cases)
   - allows read on own prefix → returns value, inner.get called once
   - blocks read on foreign integration prefix → returns `undefined`,
     inner.get NOT called, warn logged with `{ pluginId, key }`
   - allows read on each `GLOBAL_READABLE_KEYS` entry (parametrize)
   - throws on write to foreign key → inner.set NOT called
   - throws on `setMany` with any foreign key → inner.setMany NOT called
   - returns `{}` from `getAll`, warn logged
   - returns `{}` from `getByPrefix` when prefix is foreign, warn logged
   - `getMqttConfig` throws for non-zigbee2mqtt plugin, succeeds for zigbee2mqtt

   **EventBusProxy** (4 cases)
   - allows each of the four whitelisted event types (parametrize)
   - drops non-whitelisted types → inner.emit NOT called, warn logged
   - drops `integrationId` impersonation → inner.emit NOT called, warn
     mentions both `pluginId` and `claimed`
   - `on()` and `onType()` pass through to inner (subscriptions allowed)

   **DeviceManagerProxy** (6 cases)
   - `upsertFromDiscovery` with foreign `integrationId` in payload →
     inner.upsertFromDiscovery called with `integrationId` overridden
     to caller's pluginId (assert the exact argument)
   - `updateDeviceData` throws when `integrationId !== pluginId`,
     inner NOT called
   - `updateDeviceStatus` throws on mismatch
   - `removeStaleDevices` throws on mismatch
   - `migrateIntegrationId` throws when `newId !== pluginId`
   - read methods (`getAll`, `getById`, `getDeviceDataValue`) pass through

   **wrapPluginMethods** (8 cases)
   - `refresh()` throwing → swallowed, returns `undefined`, error
     logged with `{ pluginId, method: "refresh", err }`
   - `executeOrder()` throwing → rethrows, error logged
   - `start()` throwing → rethrows
   - `stop()` throwing → rethrows
   - `getStatus()` throwing → returns `"error"`, error logged
   - `isConfigured()` throwing → returns `false`
   - `getSettingsSchema()` throwing → returns `[]`
   - slow call (>1s, fake timers) → warn logged with `{ method, ms }`

9. [ ] Run `npx vitest run src/plugins/scoped-deps.test.ts`. Target
       ~26 test cases, all green. Coverage on `scoped-deps.ts` should be
       100% lines and 100% branches (verify with
       `npx vitest run --coverage src/plugins/scoped-deps.ts`).

#### 3.3 Canary plugin integration test (0.5 day)

10. [ ] Create `src/plugins/__fixtures__/canary-plugin.ts`. A minimal
        `IntegrationPlugin` that **deliberately attempts each violation
        inside `start()`**, in a try/catch so it never crashes itself:

    ```ts
    export function createCanaryPlugin(deps: PluginDeps): IntegrationPlugin {
      const attempts: Record<string, unknown> = {};
      return {
        id: "canary",
        name: "Canary",
        description: "Deliberate-violation test plugin",
        icon: "bug",
        getStatus: () => "connected",
        isConfigured: () => true,
        getSettingsSchema: () => [],
        async start() {
          // (1) foreign read
          attempts.stolenToken = deps.settingsManager.get("integration.netatmo.refresh_token");
          // (2) foreign write
          try {
            deps.settingsManager.set("integration.netatmo.evil", "x");
            attempts.foreignWrite = "no-throw";
          } catch (e) {
            attempts.foreignWrite = "threw";
          }
          // (3) forbidden emit
          deps.eventBus.emit({ type: "equipment.data.changed", equipmentId: "x" } as any);
          // (4) impersonation
          deps.eventBus.emit({ type: "system.integration.connected", integrationId: "netatmo" });
          // (5) foreign device mutation
          try {
            deps.deviceManager.updateDeviceData("netatmo", "x", "k", "v", "string");
            attempts.foreignDevice = "no-throw";
          } catch (e) {
            attempts.foreignDevice = "threw";
          }
          // expose attempts for assertions
          (globalThis as any).__canaryAttempts = attempts;
        },
        async stop() {},
        async executeOrder() {},
        async refresh() {
          throw new Error("canary refresh boom");
        },
      };
    }
    ```

11. [ ] Create `src/plugins/plugin-loader.integration.test.ts`:
    - Spin up a real `SettingsManager` over `better-sqlite3` in-memory
      (`new Database(":memory:")`)
    - Seed `integration.netatmo.refresh_token = "SECRET"` directly
    - Build real `EventBus`, real `DeviceManager` (in-memory schema)
    - Manually invoke the scoped-deps wiring on the canary (without
      going through file I/O / PackageManager — just call the same
      builder used in `plugin-loader.ts`)
    - Call `canary.start()`
    - Assertions:
      - `globalThis.__canaryAttempts.stolenToken === undefined`
      - `globalThis.__canaryAttempts.foreignWrite === "threw"`
      - `globalThis.__canaryAttempts.foreignDevice === "threw"`
      - the `EventBus` did NOT receive `equipment.data.changed` (spy
        an emitter listener)
      - the `EventBus` did NOT receive a connected event with
        `integrationId === "netatmo"`
    - Then call the wrapped `refresh()`: it must not throw, and an
      `error` log line must be present
    - Then verify `settingsManager.get("integration.netatmo.refresh_token")`
      from outside the Proxy still returns `"SECRET"` (the Proxy did
      not corrupt the underlying store)

12. [ ] Run `npx vitest run src/plugins/plugin-loader.integration.test.ts`.
        Should run under 500ms (no real I/O).

#### 3.4 Regression net: existing plugin smoke test (0.25 day)

13. [ ] Add a smoke test `src/plugins/scoped-deps.smoke.test.ts` that
        loads each plugin fixture's `manifest.json` (parameterized over
        the 13 plugins by reading `/Users/mchacher/Documents/01_Geekerie/sowel-plugin-*/manifest.json`
        if present locally, else skip) and confirms that the plugin id
        appears nowhere in `ALLOWED_EMIT_TYPES` (sanity check) and that
        none of the known integration prefixes collide. This is a
        structural regression net, not a behavioral test.

    If running outside the local dev machine (CI without sibling
    plugin repos), skip with `it.skipIf(!existsSync(...))`.

### Phase 4 — Observation in dev (0.5 day)

14. [ ] Boot Sowel locally with `SOWEL_PLUGIN_ISOLATION=true npm run dev`.
15. [ ] Trigger normal operations across the 13 plugins: enable each
        one in the UI, let pollers run, exercise OAuth flows where present,
        issue orders to a few devices.
16. [ ] Grep `data/logs/sowel.*.log` for `"Plugin denied"`. Investigate
        every occurrence:
    - If it is a legitimate use case (e.g. `weather-forecast` reading
      `home.latitude`), the key should already be in
      `GLOBAL_READABLE_KEYS`. If not, add it and document why.
    - If it is a bug in the plugin, file an issue on that plugin's
      repo. **Do not** loosen the Proxy to accommodate buggy plugins.
17. [ ] Grep for `"Plugin async method threw"` and
        `"Plugin sync method threw"`. Same triage.

### Phase 5 — Documentation (1 day)

18. [ ] Update `docs/technical/plugin-development.md` and `.fr.md`:
        add a "Plugin scoping (spec 111)" section right after the
        `PluginDeps` description. List the four invariants in plain
        English/French, with the explicit allowlists
        (`ALLOWED_EMIT_TYPES`, `GLOBAL_READABLE_KEYS`) and a one-liner
        on how to extend them (PR against `scoped-deps.ts`). Include the
        "what this does not protect" caveats.
19. [ ] Add a "Plugin soft isolation (spec 111)" note in `CLAUDE.md`
        after the spec 108 section, telling future agents that new plugins
        are sandboxed and how to extend the allowlists when reviewing PRs.
20. [ ] Update [docs/audit/2026-05-19-architectural.md](docs/audit/2026-05-19-architectural.md):
    - In § 1.1 Top 20 table, append `*(partiellement mitigé par spec 111)*`
      to F02 line
    - In § 3.2 list the four invariants as the in-place mitigation
    - In § 3.3 lower F02 priority from "Critical / L" to "High / L"
      (residual hard-isolation gap remains)
21. [ ] Update `docs/specs-index.md` and `.fr.md` to add the spec 111
        entry (the audit's F05 separately tracks the broader regeneration
        problem; this is the minimum to keep the index consistent for the
        new spec).

### Phase 6 — Rollout (0.5 day)

22. [ ] PR `feat/plugin-soft-isolation` with all of the above. Flag
        still defaulted **off**.
23. [ ] Merge to `main`. Tag the next release (probably v1.10.4 or
        v1.11.0 depending on scope of the release) and ship with the flag
        off. Document in release notes: "Spec 111 plumbing landed, opt-in
        via `SOWEL_PLUGIN_ISOLATION=true`. Default-on planned for next
        minor."
24. [ ] Run the flag on for one week in personal production
        (`sowelox`). Monitor `Plugin denied` lines daily. Adjust allowlists
        only if a legitimate use case surfaces.
25. [ ] Follow-up PR: flip the default to `on` in `config.ts`. Add a
        release-notes entry. Keep the env var as escape hatch.

## Test plan

Three layers, defined in Phase 3 above. Summary:

| Layer                | Where                                                       | Speed  | Coverage                                          |
| -------------------- | ----------------------------------------------------------- | ------ | ------------------------------------------------- |
| Unit                 | `scoped-deps.test.ts`                                       | <100ms | All 4 invariants × ~26 cases, 100% lines/branches |
| Integration          | `plugin-loader.integration.test.ts` + canary plugin fixture | <500ms | Real wiring through `plugin-loader.loadPlugin`    |
| Smoke regression     | `scoped-deps.smoke.test.ts`                                 | <100ms | Sanity over the 13 real plugins (if local)        |
| Manual / observation | Dogfooding on sowelox with flag on                          | 7 days | All 13 plugins exercised under real load          |

### Logger assertion pattern

All log-related assertions go through a single helper to keep the
test surface uniform:

```ts
function expectWarn(logger: MockLogger, expected: Record<string, unknown>) {
  expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining(expected), expect.any(String));
}
```

Reason: pino calls are `(context, message)`. A test asserting on the
exact message string would be brittle to wording tweaks. Asserting on
the context object (which holds `pluginId`, `key`, `eventType`, etc.)
is stable and matches the audit-trail contract documented in
`architecture.md` § "Logging contract".

### Acceptance matrix

The five risk scenarios from `spec.md` § Acceptance criteria are the
explicit verification matrix. Each row maps to a specific unit case
and the corresponding canary assertion:

| Scenario                                                     | Expected after spec 111                                | Unit case ID                         | Canary assertion                                      |
| ------------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------ | ----------------------------------------------------- |
| Plugin A reads `integration.<B>.refresh_token`               | `undefined` + warn log                                 | SettingsManagerProxy / foreign read  | `__canaryAttempts.stolenToken === undefined`          |
| Plugin emits `equipment.data.changed`                        | Emit dropped + warn log                                | EventBusProxy / non-whitelisted      | EventBus listener never saw the event                 |
| Plugin `refresh()` throws on stale token                     | Caught + error log, Sowel keeps running                | wrapPluginMethods / refresh throws   | `await canary.refresh()` did not throw                |
| Plugin A calls `upsertFromDiscovery({ integrationId: "B" })` | Device created with `integrationId = "A"` (overridden) | DeviceManagerProxy / forced override | Mock DeviceManager received `integrationId: "canary"` |
| Plugin throws synchronously in `getStatus()`                 | Returns `"error"`, UI shows degraded status, no crash  | wrapPluginMethods / getStatus throws | (covered by unit only)                                |

### Manual observation protocol

Phase 4 (dogfooding) runs after merge with the flag off, then with
the flag on for 7 days. Procedure:

```bash
# Day 0: enable
ssh mchacher@192.168.0.230 \
  "cd /opt/sowel && sed -i 's/SOWEL_PLUGIN_ISOLATION=false/SOWEL_PLUGIN_ISOLATION=true/' docker-compose.yml \
   && docker compose up -d"

# Daily check (D+1 to D+7)
ssh mchacher@192.168.0.230 \
  "docker exec sowel grep -E 'Plugin (denied|.* threw)' /app/data/logs/sowel.*.log | wc -l"
```

Success criterion: every line found is triaged into one of two buckets
within 24h:

- **False positive**: legitimate use case → patch `ALLOWED_EMIT_TYPES`
  or `GLOBAL_READABLE_KEYS`, ship a follow-up minor
- **True positive**: plugin bug → open issue on the plugin repo, leave
  the Proxy line as-is

Zero unclassified lines after 7 days = pass. The flag flips to
default-on (task 20).

### Coverage targets

The CI step `npx vitest run --coverage src/plugins/` should report:

- `scoped-deps.ts`: 100% lines, 100% branches (every Proxy code path
  is reachable via unit tests)
- `plugin-loader.ts`: at least 80% lines on the new scoping branch
  (the rest is existing code outside this spec's scope)

A drop below these thresholds in a future PR is a signal to add tests,
not to lower the thresholds.

## Rollback strategy

Set `SOWEL_PLUGIN_ISOLATION=false` in the `docker-compose.yml`
environment, `docker compose up -d`. The Proxies and wrappers are
skipped entirely; raw `PluginDeps` are passed as before. Plugins are
back to the pre-spec-111 behavior in seconds.

No DB state to roll back, no schema change. The env var is the entire
revert surface.

## Out of scope, to track for spec 111b / 111c

- **Hard isolation via worker_threads**: spec 111b. Requires plugin API
  v2 (async message passing), big ecosystem cost. Only when registry
  opens to external authors.
- **Manifest-declared allowlists** (`requiredGlobalReads`,
  `emitsEventTypes`): spec 111c. Cleaner than the static const sets in
  `scoped-deps.ts`. Migrate after a stability window.
- **`fetch()` interception** / network observability: not strictly
  isolation, but a low-effort follow-up that gives per-plugin network
  metrics. Optional.
