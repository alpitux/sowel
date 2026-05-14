# Spec 099 — Design System Phase 5: Equipment Row

> Phase 5 of the [094 UI redesign umbrella](../094-ui-redesign/spec.md). The "long pole" of the redesign, but reframed: the row chrome is shared in one component, so it's a single refactor — not 21.

## Problem

The equipment row (used in every zone view, hundreds of instances) renders today via `CompactEquipmentCard.tsx` with these gaps vs [design-system/components/eq-row.md](../../design-system/components/eq-row.md):

| Aspect       | Production today                         | Design system target                              |
| ------------ | ---------------------------------------- | ------------------------------------------------- |
| Layout       | `flex items-center gap-2.5`              | `grid grid-cols-[32px_1fr_auto_auto_auto] gap-3`  |
| Icon size    | 28×28 (`w-7 h-7 rounded-[5px]`)          | 32×32 (`w-8 h-8 rounded-md`)                      |
| Icon tint    | Uniform (one `iconColor` chain)          | Per-category (`bg-light-50 text-light-500`, etc.) |
| Light ON cue | None (just power button shows the state) | Amber background + white icon + 3.2s glow pulse   |
| Min-height   | Implicit (~36 px from padding)           | 52 px fixed (cross-panel alignment)               |

The grid layout matters because every panel (Équipements, Modes, Recettes, Activité) aligns vertically by the same 52 px row height. Today, mode rows and equipment rows visibly differ in height — minor but persistent.

## Goal

Refactor `CompactEquipmentCard.tsx` to adopt the design-system row pattern: 5-column grid, 32 px icon with category tinting, fixed 52 px min-height, and a glow animation on the lit-light icon.

The per-type control components (`LightControl`, `ShutterControl`, `HeaterControl`, `ThermostatCard`, `GateControl`, `WaterValveControl`, `PoolHeatPumpControl`) are **not touched** — they already work via their `compact` prop and slot into the grid naturally.

## Non-negotiable constraint

> **No data flow changes.** The bindings, equipment store, websocket updates, and order dispatch logic are all preserved. Only the row's visual chrome and the way the icon is rendered change.

## In scope

1. Refactor [CompactEquipmentCard.tsx](../../ui/src/components/home/CompactEquipmentCard.tsx) chrome:
   - Replace flex with grid: `grid grid-cols-[32px_1fr_auto_auto_auto] gap-3 items-center px-4 py-2 min-h-[52px]`
   - Icon container: `w-8 h-8 rounded-md` (was `w-7 h-7 rounded-[5px]`)
   - Border-top divider between rows (the existing hover stays)
2. Per-type icon tinting: map each `EquipmentType` to a Tailwind `bg-{cat}-50 text-{cat}-500` class chain. Categories: light, shutter, sensor, media, plus thermostat / heater / gate / water-valve / appliance fallback to neutral or info tint.
3. Light "ON" state: amber background + white icon + 3.2s glow ring animation. Glow honors `prefers-reduced-motion` (already global in tokens.css).
4. Add @theme aliases in `ui/src/index.css` for design-system category tokens so the Tailwind utilities `bg-light-50`, `text-light-500`, `bg-shutter-50`, etc. exist.
5. Add `.animate-glow` utility class in `ui/src/index.css` to expose the existing `@keyframes glow` already defined in `design-system/tokens.css`.

## Out of scope

- The per-type control components (LightControl, ShutterControl, etc.) — their internal layouts are unchanged.
- The admin EquipmentCard.tsx (different list, different context).
- The MobileWidgetCard / dashboard widgets (different pattern — covered by spec 098).
- New equipment types or new control affordances.
- Sensor display layout (SensorValues stays as-is).
- The activity feed and mode rows — they have their own row patterns.

## Acceptance criteria

- [x] CompactEquipmentCard root uses CSS grid 5-col layout
- [x] Icon container is 32×32 with `rounded-md`
- [x] Each equipment type maps to a per-category icon tint via a typed map
- [x] Lit light shows amber bg + white icon + glow animation (Playwright verified on Séjour: Applique x 1, Appliques x 2)
- [x] Glow respects `prefers-reduced-motion` (inherited from global rule in tokens.css)
- [x] Row min-height is 52 px (visible alignment in Séjour zone)
- [x] Per-type control components render unchanged in their slot (LightControl slider+power, ShutterControl 3-btn group, sensors all OK)
- [x] Sensor values display correctly (PIRL: 1672lx + RAS + 100%)
- [x] Disabled equipment shows "désactivé" suffix in name as today
- [x] Type-check, lint, vitest, build all pass (429 tests)
- [x] Mobile (390px) — Playwright verified, layout intact, no overflow

## Edge cases

| Case                                                        | Expected                                                                |
| ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| Equipment with 0 data bindings                              | Row renders, icon visible, no controls slot — empty grid cells collapse |
| Light ON state from data binding                            | Amber tint + glow visible                                               |
| Light OFF                                                   | Light category tint (yellow-tinted neutral) without glow                |
| Shutter at partial position (50%)                           | Shutter icon tinted, slider + position chip in grid slots               |
| Sensor with motion + temperature                            | All bindings rendered via SensorValues in the auto column               |
| Generic equipment (unknown type)                            | Falls back to neutral icon tint, primary value displayed in auto column |
| Long equipment name (e.g. "Appliques porche extérieur sud") | Truncates via existing `truncate` class in slot 2                       |
| `prefers-reduced-motion: reduce` enabled                    | No glow animation on lit lights (global rule in tokens.css)             |
| Mobile viewport (390 px)                                    | Grid stays one row; sub-controls may scroll horizontally if too crowded |
| Dark mode                                                   | All category tints adapt via design system tokens (no hard-coded hex)   |
| Pool pump with runtime badge                                | Runtime fits in the auto column alongside the power button              |
| Multiple sensor types (weather: temp + rain + wind)         | Filtered subset still renders correctly                                 |

## References

- [design-system/components/eq-row.md](../../design-system/components/eq-row.md)
- [design-system/tokens.css](../../design-system/tokens.css) — category tints + `@keyframes glow`
- [design-system/migration.md](../../design-system/migration.md) Phase 5
- [ui/src/components/home/CompactEquipmentCard.tsx](../../ui/src/components/home/CompactEquipmentCard.tsx) — current implementation
