# Spec 109 — Preserve bound device data/orders across partial re-discoveries

> Bug fix. A partial discovery announcement was silently destroying equipment bindings via FK CASCADE.

## Problem

On 2026-05-17, the `Volet Piscine` (pool_cover, id `353fd74e-...`) in production silently lost its `shutter_state` order binding (and `shutter_position` data binding) to the underlying SONOFF 4CH PRO over Tasmota. The user noticed the open/close/stop control had vanished from the UI. The bindings had to be re-created by hand.

Root cause traced to [src/devices/device-manager.ts:206-256](src/devices/device-manager.ts#L206-L256) inside `upsertFromDiscovery`:

```ts
// Remove stale data entries no longer exposed by the device
for (const row of existingDataRows) {
  if (!discoveredDataKeys.has(row.key)) {
    this.stmts.deleteDeviceDataById.run(row.id);
  }
}
// (same loop for orders)
```

Combined with the schema in `migrations/001_initial.sql`:

```sql
CREATE TABLE order_bindings (
  ...
  device_order_id TEXT NOT NULL REFERENCES device_orders(id) ON DELETE CASCADE,
  ...
);
```

Whenever an integration plugin re-publishes its device discovery (e.g. on plugin reconnect after a Sowel restart, on MQTT reconnect, on bridge restart), the device-manager re-syncs the `data` and `orders` lists. If the announcement omits a key — even briefly, even by mistake, even mid-boot — that key's `device_data` / `device_orders` row is deleted, and the FK CASCADE wipes every equipment binding pointing at it.

In the pool-cover case, the SONOFF's `shutter_state` / `shutter_position` keys were almost certainly missing from one announcement during the v1.10.0 deploy restart (the Tasmota shutter module is initialised separately from `power1`/`power2`, which never miss an announcement). The CASCADE fired, the binding was gone. A later complete announcement restored the `device_orders` row with the same stable id, but the binding had already been destroyed.

`pool_pump`'s binding survived because its order `state` maps to `power1`/`power2` — base Tasmota status, always present in every discovery message.

## Goal

A transient or partial discovery announcement MUST NOT destroy equipment bindings.

## Approach

Inside the stale-cleanup loops in `upsertFromDiscovery`, skip any `device_data` / `device_orders` row that an equipment currently binds to. The cleanup still removes truly orphaned rows (no equipment touches them), so genuine device-side changes (firmware update removes a feature) are not retained forever — but only when the row is unused.

The rationale: a row that is bound represents a user-meaningful link. Even if the integration temporarily fails to announce its key, the system should hold the line until the user explicitly unbinds. Recovery is preferable to silent destruction.

Pseudocode:

```ts
for (const row of existingRows) {
  if (discoveredKeys.has(row.key)) continue;
  const bound = countBindingsForRow(row.id);
  if (bound > 0) {
    logger.info({ deviceId, id: row.id, key: row.key }, "Stale row kept (bound to equipment)");
    continue;
  }
  delete row.id;
}
```

## Out of scope

- Periodic explicit cleanup for "old, bound but unused" rows. Could be a future admin action.
- Removing the FK CASCADE entirely. The cascade still does the right thing when a device is deliberately removed (full row deletion in `devices` cascades through). The fix is to stop _triggering_ the cascade on transient incompleteness, not to disable cascade.
- Re-binding logic. If a binding does get destroyed (e.g. by older code paths or manual SQL), the user must re-bind via the existing UI.

## Acceptance criteria

- [x] A re-discovery announcement that omits a key WHILE that key is bound to an equipment leaves both the `device_data`/`device_orders` row and the binding intact.
- [x] A re-discovery announcement that omits a key WHILE that key is unbound still deletes the row (existing cleanup semantics preserved).
- [x] Vitest tests cover both cases in `src/devices/device-manager.test.ts`.
- [x] A pino info log fires when a stale row is kept, so the situation is observable in production.

## Test plan

| Module         | Scenario                                                  | Expected                                                             |
| -------------- | --------------------------------------------------------- | -------------------------------------------------------------------- |
| device-manager | Re-discovery omits an order key that has an order_binding | Order row preserved, binding preserved (`device_order_id` unchanged) |
| device-manager | Re-discovery omits a data key that has a data_binding     | Data row preserved, binding preserved (`device_data_id` unchanged)   |
| device-manager | Re-discovery omits an unbound order key                   | Order row deleted (existing behavior)                                |
| device-manager | Re-discovery omits an unbound data key                    | Data row deleted (existing behavior)                                 |

All three scenarios live in `src/devices/device-manager.test.ts` (new tests appended to the `upsertFromDiscovery` describe block).

## Files touched

```
src/devices/device-manager.ts            (skip-when-bound in two cleanup loops + 2 prepared statements)
src/devices/device-manager.test.ts       (3 regression tests)
specs/109-device-discovery-preserve-bound/spec.md
```

## Effort

~30 min. Backend-only, two surgical edits + tests.
