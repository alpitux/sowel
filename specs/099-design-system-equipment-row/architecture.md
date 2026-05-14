# Architecture — Spec 099 — Equipment Row

## Overview

Refactor of a single component (`CompactEquipmentCard.tsx`) + two small CSS additions in `ui/src/index.css`. No backend, no state, no data model.

## Changes

### 1. `ui/src/index.css` — @theme aliases + glow utility

Add 8 color aliases and one animation utility:

```css
@theme {
  /* ... existing aliases ... */

  /* Equipment category tints — from design-system/tokens.css */
  --color-light-50: var(--light-50);
  --color-light-500: var(--light-500);
  --color-shutter-50: var(--shutter-50);
  --color-shutter-500: var(--shutter-500);
  --color-sensor-50: var(--sensor-50);
  --color-sensor-500: var(--sensor-500);
  --color-media-50: var(--media-50);
  --color-media-500: var(--media-500);
}

/* Light "ON" glow ring — uses @keyframes glow from design-system/tokens.css */
.animate-glow {
  animation: glow 3.2s ease-in-out infinite;
}
```

After this, the Tailwind utilities `bg-light-50`, `text-light-500`, `bg-shutter-50`, etc. exist.

### 2. `CompactEquipmentCard.tsx` — chrome refactor

Replace the root wrapper:

```tsx
// Before
<div className="flex items-center gap-2.5 px-3 py-2 transition-colors duration-150 hover:bg-border-light/40">
  {/* Icon */}
  <div className={`flex-shrink-0 w-7 h-7 rounded-[5px] flex items-center justify-center ${iconColor}`}>
    {iconElement}
  </div>
  {/* Name */}
  <Link className="flex-1 min-w-0 ...">...</Link>
  {/* Per-type content & controls (varies) */}
</div>

// After
<div className="grid grid-cols-[32px_1fr_auto_auto_auto] gap-3 items-center px-4 py-2 min-h-[52px] transition-colors duration-150 hover:bg-border-light/40">
  {/* Icon — slot 1 */}
  <div className={`w-8 h-8 rounded-md flex items-center justify-center ${tint.bg} ${tint.text} ${isLightOn ? 'animate-glow' : ''}`}>
    {iconElement}
  </div>
  {/* Name — slot 2 */}
  <Link className="min-w-0 ...">...</Link>
  {/* Slots 3/4/5 — per-type content laid out as needed */}
</div>
```

### 3. Per-type tint map

Define a typed map at the top of the file:

```tsx
type Tint = { bg: string; text: string };

const TYPE_TINTS: Record<EquipmentType, Tint> = {
  light_onoff: { bg: "bg-light-50", text: "text-light-500" },
  light_dimmable: { bg: "bg-light-50", text: "text-light-500" },
  light_color: { bg: "bg-light-50", text: "text-light-500" },
  shutter: { bg: "bg-shutter-50", text: "text-shutter-500" },
  pool_cover: { bg: "bg-shutter-50", text: "text-shutter-500" },
  sensor: { bg: "bg-sensor-50", text: "text-sensor-500" },
  button: { bg: "bg-sensor-50", text: "text-sensor-500" },
  switch: { bg: "bg-sensor-50", text: "text-sensor-500" },
  thermostat: { bg: "bg-primary-light", text: "text-primary" },
  heater: { bg: "bg-error/10", text: "text-error" },
  gate: { bg: "bg-success/10", text: "text-success" },
  water_valve: { bg: "bg-primary-light", text: "text-primary" },
  media_player: { bg: "bg-media-50", text: "text-media-500" },
  appliance: { bg: "bg-border-light", text: "text-text-secondary" },
  energy_meter: { bg: "bg-accent-light", text: "text-accent" },
  main_energy_meter: { bg: "bg-accent-light", text: "text-accent" },
  energy_production_meter: { bg: "bg-success/10", text: "text-success" },
  weather: { bg: "bg-primary-light", text: "text-primary" },
  weather_forecast: { bg: "bg-primary-light", text: "text-primary" },
  pool_pump: { bg: "bg-primary-light", text: "text-primary" },
  pool_heat_pump: { bg: "bg-error/10", text: "text-error" },
};
```

When the equipment is a lit light, override:

```tsx
const tint = isLightOn ? { bg: "bg-accent", text: "text-white" } : TYPE_TINTS[equipment.type];
```

### 4. Grid slot mapping

The 5 grid columns map to:

| Col | Slot            | What renders                                         |
| --- | --------------- | ---------------------------------------------------- |
| 1   | Icon            | The 32×32 tinted icon container                      |
| 2   | Name            | The `<Link>` to the equipment detail (truncates)     |
| 3   | Primary value   | Sensor values, energy values, weather forecast strip |
| 4   | Secondary value | Mode chip, state badge, position percentage          |
| 5   | Action          | LightControl / ShutterControl / power button etc.    |

Empty slots collapse to 0 via `grid-cols-[... auto auto auto]` — `auto` doesn't reserve space.

Per-type rendering blocks in the current `CompactEquipmentCard` already produce the right content; they just need to land in the right slot order. Some per-type blocks (e.g. PoolPumpRuntime + LightControl) span two slots — fine for `auto auto auto` (each child takes its natural width).

## File changes

| File                                              | Change                                               |
| ------------------------------------------------- | ---------------------------------------------------- |
| `ui/src/components/home/CompactEquipmentCard.tsx` | Refactor root chrome, add TYPE_TINTS map, glow logic |
| `ui/src/index.css`                                | Add 8 @theme aliases + `.animate-glow` utility       |

## Risk assessment

| Risk                                                                                                   | Likelihood | Mitigation                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grid layout breaks the right-side controls in a per-type block (e.g. pool pump runtime + power button) | Medium     | All current per-type blocks render their children inline; the grid `auto` columns accept any number of children naturally. Test pool pump specifically. |
| Glow animation too strong / distracting                                                                | Low        | Already calibrated via design-system (5px ring at 14% opacity peak). Easy to tune CSS if user dislikes.                                                 |
| Per-type tint clashes with the icon's own color (Lucide icons inherit `currentColor`)                  | Low        | Tints set both `bg` and `text` color — Lucide icons inherit `text-*` correctly via `currentColor` default.                                              |
| Row min-height 52 px feels too tall                                                                    | Low        | Matches the design system + mode/recipe row alignment. If user dislikes, can soften to 48 px.                                                           |
| Long equipment name truncates on more screens than before                                              | Low        | `truncate` class preserved on the name Link.                                                                                                            |
| Mobile viewport — 5-col grid feels cramped                                                             | Medium     | Sensor/control auto slots collapse naturally; test on 390 px. If overflow, allow horizontal scroll.                                                     |
| Existing per-type control component layouts conflict with the grid item alignment                      | Low        | Per-type components are leaves; they don't impose layout on the parent.                                                                                 |

## Rollback

`git revert` of the commit. Two files modified.

## References

- [design-system/components/eq-row.md](../../design-system/components/eq-row.md)
- [design-system/tokens.css](../../design-system/tokens.css) — glow + category tokens
- [ui/src/components/home/CompactEquipmentCard.tsx](../../ui/src/components/home/CompactEquipmentCard.tsx)
- [ui/src/index.css](../../ui/src/index.css)
