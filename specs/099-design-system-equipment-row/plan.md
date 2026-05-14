# Plan — Spec 099 — Equipment Row

## Implementation steps

1. **Branch**: `git checkout -b feat/design-system-equipment-row`
2. **Update `ui/src/index.css`** — add 8 @theme color aliases (light, shutter, sensor, media × 50/500) + `.animate-glow` utility.
3. **Refactor `CompactEquipmentCard.tsx`**:
   - Add `TYPE_TINTS` typed map at the top of the file.
   - Compute `isLightOn` from `isLight && isOn`.
   - Replace the root `<div className="flex...">` with the grid layout.
   - Bump icon container `w-7 h-7 rounded-[5px]` → `w-8 h-8 rounded-md` + apply tint + conditional `.animate-glow`.
   - Verify each per-type block renders in the right column order. Since the columns after the name are all `auto`, the existing per-type blocks slot in naturally.
4. **Visually verify via Playwright on localhost:5173** (dev server still running from spec 095):
   - Zone with mixed equipments (light on/off, shutter, sensor, gate, energy meter)
   - Light glow visible on lit lights (no glow on off)
   - Row alignment with mode rows below
   - Mobile viewport 390 px
   - Dark mode toggle
5. **Validate** (Gate 4): `npx tsc --noEmit` (both), `cd ui && npm run build`, `npx vitest run`, `npx eslint src/ --ext .ts`.
6. **Commit** with conventional message.
7. **Open PR** with screenshots: light off, light on (with glow), shutter partial, sensor, full zone view.

## Test plan

### Modules touched

- `ui/src/components/home/CompactEquipmentCard.tsx` (chrome refactor + tint map)
- `ui/src/index.css` (@theme aliases + animation utility)

### Why no unit tests

Per CLAUDE.md "no React tests in this project". This spec is JSX rendering + CSS — no business logic touched. The existing per-type control components are not modified. The existing Vitest suite (429 tests) must continue to pass.

### Manual verification scenarios

| Scenario                                                       | Expected                                                                              |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Open a zone with one light off                                 | Light icon with `bg-light-50 text-light-500`, no animation                            |
| Toggle the light on (via UI or external)                       | Icon switches to amber background, white icon, glow ring animates                     |
| Toggle off                                                     | Returns to base tint, glow stops                                                      |
| Zone with shutter at 50%                                       | Shutter icon `bg-shutter-50 text-shutter-500`, slider + position chip in auto columns |
| Zone with motion sensor                                        | Sensor icon `bg-sensor-50 text-sensor-500`, sensor values right-aligned               |
| Zone with gate                                                 | Gate icon green-tinted, "Ouvert/Fermé" chip                                           |
| Zone with thermostat                                           | Primary-tinted icon, current temp + ± controls                                        |
| Zone with energy meter                                         | Amber accent-light icon, kWh value                                                    |
| Zone with media_player on                                      | Media-tinted icon, source name                                                        |
| Zone with appliance running (washing machine)                  | Neutral icon, running chip, time remaining                                            |
| Empty equipment (no bindings)                                  | Row renders, icon visible, name shown                                                 |
| Disabled equipment                                             | "désactivé" suffix in name                                                            |
| Long equipment name                                            | Truncates with `truncate` class in slot 2                                             |
| Cross-panel alignment (Équipements + Comportements + Activité) | All rows at 52 px height visually align                                               |
| Mobile (390 px) — full zone view                               | Grid stays one row; per-type controls may horizontal-scroll if too crowded            |
| Dark mode toggle                                               | All tints adapt; glow contrast intact                                                 |
| `prefers-reduced-motion: reduce`                               | Glow doesn't animate (verified via DevTools "Emulate CSS media feature")              |

## Tasks

- [x] Branch `feat/design-system-equipment-row` created
- [x] `ui/src/index.css` — 8 @theme aliases + `.animate-glow` added
- [x] `CompactEquipmentCard.tsx` — `TYPE_TINTS` map added (21 equipment types)
- [x] `CompactEquipmentCard.tsx` — root chrome refactored to 5-col grid + 52 px min-height
- [x] `CompactEquipmentCard.tsx` — icon container 32 px + tint + glow on lit light
- [x] Playwright visual verification — Maison, RDC, Séjour (desktop), Séjour (mobile 390px)
- [x] Gate 4 passes (tsc + build + vitest + eslint, 429 tests)
- [ ] Commit on feat branch (no Co-Authored-By)
- [ ] PR opened with screenshots
- [ ] User approval before merge
