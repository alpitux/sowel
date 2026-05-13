# Spec 099 — Design System Phase 5: Equipment Row

> Light scoping spec — part of the [094 UI redesign umbrella](../094-ui-redesign/spec.md). Expanded into full spec when picked up via `/sowel-feature`. Long-pole phase: **one PR per equipment type**.

## Problem

The equipment row is the most repeated visual pattern in the app (21 types, hundreds of instances across zones). Today, each control component (`LightControl`, `ShutterControl`, etc.) re-renders its own structure. There's no shared `.eq` grid; row heights drift; icon backgrounds vary.

## Goal

Adopt the `.eq` grid + `.eq__icon--{type}` modifier pattern from [design-system/components/eq-row.md](../../design-system/components/eq-row.md). Refactor each equipment type one PR at a time — never touch the whole `equipments/` folder in one go.

## In scope (per sub-PR)

Each sub-PR migrates **one equipment type**. Suggested order:

1. `LightControl.tsx` → `.eq__icon--light-on` + glow animation
2. `ShutterControl.tsx` → `.shutter-grp` 3-button segmented control
3. `HeaterControl.tsx` → `therm-icon` + `±` target buttons
4. `GateControl.tsx` → `.gate-cmd` button
5. Sensor controls (temperature, humidity, motion, smoke, leak, lux, contact, button, CO2, pressure)
6. `EnergyMeter`, `WaterValve`, `MediaPlayer`, `PoolCover`, `PoolPump`
7. `WeatherStation`, `WeatherForecast`
8. `WashingMachine` and any remaining appliance types

## Out of scope (per sub-PR)

- Backend logic.
- Order dispatch changes.
- Changes to Device → Equipment binding logic.

## Acceptance criteria (overall, when all sub-PRs ship)

- [ ] `.eq` grid used by every equipment type
- [ ] 52 px row height invariant (cross-panel alignment holds)
- [ ] Light "on" state shows amber glow
- [ ] Shutter 3-button segmented control everywhere
- [ ] No more inline `flex grid-cols-...` definitions in equipment components

## References

- [design-system/components/eq-row.md](../../design-system/components/eq-row.md)
- [design-system/components/shutter-grp.md](../../design-system/components/shutter-grp.md)
- [design-system/components/power-button.md](../../design-system/components/power-button.md)
- [design-system/migration.md](../../design-system/migration.md) Phase 5
