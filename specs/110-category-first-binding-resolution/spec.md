# Spec 110 — Category-first binding resolution across the codebase

> Architectural refactor split into 3 PRs. No new user-facing feature; the
> goal is to make the existing `alias` / `category` contract live up to its
> design promise.

## Problem

A binding (data or order) carries two identifiers:

- `alias` — a per-equipment string label, often equal to the device key.
- `category` — a typed concept from `DataCategory` / `OrderCategory` in
  [src/shared/types.ts](src/shared/types.ts) (e.g. `shutter_move`,
  `pool_cover_move`, `set_brightness`, `temperature`).

The design intent (specs 069/070/073/074/077/079) is that **callers
resolve bindings by category**, treating alias as cosmetic. The category
catalog is the contract.

A cross-file audit run on 2026-05-17 (right after fixes for spec 109 +
v1.10.2) found that the canonical category-first resolver pattern exists
in only **four places**, while ~15+ other UI and recipe sites resolve
bindings by **hardcoded alias literals**. Production has not broken
widely because:

- Auto-binding defaults `alias = device.key`.
- Most plugins (Z2M, basic Tasmota, lora2mqtt) expose canonical keys
  (`state`, `brightness`, `power`, `setpoint`) that match the literals.

The pool_cover case (v1.10.2) was the first reported breakage: the
SONOFF 4CH PRO over Tasmota exposes `shutter_state`, not `state`, so the
literal lookup found nothing.

Every plugin that picks a non-canonical key, every user that renames a
binding through the UI, every new equipment type is a latent occurrence
of the same bug class. The recipe engine is especially exposed: a
broken motion-light recipe fails silently — the user notices only when
the room stays dark.

## Goal

Establish category-first / alias-fallback resolution as the single
canonical pattern across the codebase, with a shared helper instead of
copy-pasted resolvers. Remove the latent bug class.

## Approach

A migration in **three reviewable PRs**:

### PR A — Helper + tests (this PR)

- Add `findOrderByCategory` and `findDataByCategory` to
  `ui/src/components/equipments/bindingUtils.ts`.
- 12 vitest unit tests covering category match, multi-category, alias
  fallback, regex pattern fallback, precedence ordering, edge cases.
- Wire `vitest.config.ts` to also pick up `ui/src/**/*.test.ts` so UI
  pure-logic helpers are testable from the root `npx vitest run` suite
  (no React rendering, just pure functions).

The helpers are not consumed yet; PR B and PR C make them load-bearing.

### PR B — Migrate critical UI sites

Migrate the alias-hardcoded resolvers identified by the audit, in
priority order. Each is wired through `findOrderByCategory` /
`findDataByCategory` with the appropriate category set.

| File:line                                                         | Severity                                    | Reason                                                                                          |
| ----------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `EquipmentWidget.tsx:222-237` (`ShutterEquipmentWidget` twin)     | critical                                    | Identical bug to v1.10.2 — was the second copy in the same file, missed in the v1.10.2 fix      |
| `useEquipmentState.ts:57-58`                                      | critical                                    | Upstream of `CompactEquipmentCard`, `EquipmentCard`, `ZoneEquipmentsView` (≥5 downstream views) |
| `HeaterControl.tsx:26-40`                                         | critical                                    | Heater toggle                                                                                   |
| `LightControl.tsx:38-65` (brightness dispatch)                    | critical                                    | All dimmable light brightness sliders                                                           |
| `WaterValveControl.tsx:30-82`                                     | critical                                    | Valve open/close                                                                                |
| `PoolHeatPumpControl.tsx:25-68`                                   | critical                                    | Heat pump setpoint                                                                              |
| `WidgetDetailSheet.tsx:580-601, 918-937` (Light + Heater detail)  | critical                                    | Dispatch hardcoded                                                                              |
| `WidgetGrid.tsx:538-564` (`getMobileClickAction`)                 | critical                                    | Mobile direct toggle                                                                            |
| `ZoneWidget.tsx:602` (close-all-valves)                           | critical                                    | Zone-level valve close                                                                          |
| `EquipmentWidget.tsx:317-339, 733-736` (PoolHeatPump + Appliance) | critical for setpoint, moderate for display | Setpoint dispatch                                                                               |
| `EquipmentWidget.tsx:798-819` (WaterValve widget)                 | moderate                                    | No category match yet                                                                           |
| `MobileWidgetCard.tsx:91-285`                                     | cosmetic                                    | Display-only text                                                                               |
| `ZoneWidget.tsx:385-602` (other read paths)                       | cosmetic                                    | Aggregation display                                                                             |

### PR C — Migrate the recipe path

The largest single risk: `src/recipes/engine/light-helpers.ts` is the
chokepoint for `motion-light`, `switch-light`, `state-trigger-light`,
`presence-heater`. It calls `dispatchOrder(lightId, "state", …)` and
`dispatchOrder(lightId, "brightness", …)` with the alias hardcoded.

This PR introduces a backend twin of the helpers in
`src/equipments/binding-resolver.ts` (or extends `equipment-manager.ts`
directly), migrates `light-helpers.ts` and any other recipe-engine
caller, and adds dedicated vitest coverage. Hooks back into the same
category catalog declared in `src/shared/types.ts`.

## Out of scope

- **Schema gap** (audit § 4.1): `OrderCategory` lacks `operation_mode`,
  `fan_speed`, `eco_mode`, `appliance_state_set`, etc. Thermostat and
  appliance domains stay alias-keyed until categories are minted. A
  separate spec should define the missing category vocabulary.
- **Duplicate `inferBindingCategory` between backend and frontend**
  (audit § 4.3). Best addressed once the schema gap is closed.
- **MQTT publisher mapping references** (`mqtt-publish-service.ts:396`)
  use alias as a user-stored opaque identifier — by design, not
  migrated.
- **`AddBindingModal` / `BindingsPicker` UIs** expose alias as a user
  input label — by design, not migrated.

## Acceptance criteria

PR A (this one):

- [x] `findOrderByCategory` and `findDataByCategory` exported from
      `ui/src/components/equipments/bindingUtils.ts`.
- [x] 12 vitest unit tests covering the helper, all passing.
- [x] `vitest.config.ts` picks up `ui/src/**/*.test.ts`.
- [x] No call sites migrated yet — helpers exist but are unused.

PR B:

- [ ] All "critical" rows from the table above migrated to the helper.
- [ ] TypeScript + ESLint + vitest pass.
- [ ] Visual smoke on prod: shutter / heater / valve / pool_heat_pump
      controls render and dispatch correctly across compact zone view,
      equipment detail page, and mobile dashboard sheet.

PR C:

- [ ] `light-helpers.ts` resolves the move / brightness orders by
      category, with alias fallback.
- [ ] Vitest tests cover the migrated path (category match, alias
      fallback, missing-binding fallthrough).
- [ ] Any motion-light / switch-light recipe continues to dispatch
      orders correctly after the migration.

## Files touched

```
PR A:
  ui/src/components/equipments/bindingUtils.ts        (+findOrderByCategory, findDataByCategory)
  ui/src/components/equipments/bindingUtils.test.ts   (new, 12 tests)
  vitest.config.ts                                    (+ui/src/**/*.test.ts)
  specs/110-category-first-binding-resolution/spec.md (this file)

PR B:
  ui/src/components/dashboard/EquipmentWidget.tsx
  ui/src/components/equipments/useEquipmentState.ts
  ui/src/components/equipments/HeaterControl.tsx
  ui/src/components/equipments/LightControl.tsx
  ui/src/components/equipments/WaterValveControl.tsx
  ui/src/components/equipments/PoolHeatPumpControl.tsx
  ui/src/components/dashboard/WidgetDetailSheet.tsx
  ui/src/components/dashboard/WidgetGrid.tsx
  ui/src/components/dashboard/ZoneWidget.tsx
  ui/src/components/dashboard/MobileWidgetCard.tsx

PR C:
  src/recipes/engine/light-helpers.ts
  src/equipments/binding-resolver.ts (new, backend twin)
  src/equipments/binding-resolver.test.ts (new)
```

## Effort

- PR A: ~½ day, fully testable
- PR B: ~1 day, manual visual verification at the end
- PR C: ~½ day, testable

Total ~2 days spread over the next sessions.
