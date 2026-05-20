# Spec 114 — Implementation plan

## Branch

`feat/weather-station-ux`

## Ordered steps

1. **HistoryBarChart label/scale refactor** (foundation — used by point 7 of WeatherPanel later if we add the pressure mini-spark).
   - Add `pickTickInterval(count, viewportWidth)` helper.
   - Add `formatLabel(iso, range)` returning `{line1, line2?}`.
   - Add a `CustomTick` render prop for the X-axis that supports 2-line layout.
   - Pass viewport-aware font size + tick interval via a small hook (`useChartViewport`).
2. **WeatherPanel enrichments**
   - Change `PRIMARY_KEY.rain` to `sum_rain_24`.
   - Add `WindArrow` SVG (8 px stroke 1.5, rotation by angle).
   - Add `PressureTrend` row using existing history API (lazy load on panel mount).
3. **CompactEquipmentCard**
   - Extend the `equipment.type === "weather"` filter from 3 → 4 keys (add `humidity`).
   - Map units to short form (`mm` instead of `mm/24h`) to keep the row narrow.
4. **EquipmentWidget (PC)**
   - Add `WeatherStationWidget` component matching the mockup layout.
   - Dispatch `if (equipment.type === "weather") return <WeatherStationWidget ... />` before the `isSensor` fallback.
5. **WidgetDetailSheet (mobile bottom sheet)**
   - Add `WeatherDetailContent` component (flat list of all weather bindings + battery).
   - Dispatch `if (equipment.type === "weather") return <WeatherDetailContent />` before the generic `isSensor` branch.
6. **MobileWidgetCard**
   - Add `weather` case in `useMobileState` returning the 3-value summary + dedicated icon.
7. **Tests**
   - `HistoryBarChart.test.ts`: pickTickInterval boundaries, formatLabel for each range, mobile width branches.
   - `WeatherPanel.test.ts`: wind arrow angle → rotation degrees (0, 90, 180, 270, null).
8. **Validation**
   - `cd ui && npx tsc -b --noEmit`
   - `cd /Users/mchacher/Documents/01_Geekerie/Sowel && npx vitest run`
   - `cd ui && npx eslint .`
9. **Release notes**
   - Add a short entry in `docs/release-notes.md` and `docs/release-notes.fr.md` under the current unreleased section (or skip if release will batch it).
10. **PR**
    - `git push -u origin feat/weather-station-ux`
    - Open PR titled `feat(ui): weather station UX rework (spec 114)`.

## Test plan

### Modules to test

- `HistoryBarChart` — tick interval picker + label formatter.
- `WeatherPanel` — wind arrow angle mapping.

### Scenarios

| Module          | Scenario                      | Expected                               |
| --------------- | ----------------------------- | -------------------------------------- |
| HistoryBarChart | `pickTickInterval(7, 1024)`   | returns `0` (no skipping)              |
| HistoryBarChart | `pickTickInterval(30, 1024)`  | returns ~2 (≤12 labels)                |
| HistoryBarChart | `pickTickInterval(30, 340)`   | returns ~4 (≤6 labels on small mobile) |
| HistoryBarChart | `pickTickInterval(168, 1024)` | returns ~13 (≤12 labels)               |
| HistoryBarChart | `formatLabel(iso, "24h")`     | `{line1: "HH:MM"}` only                |
| HistoryBarChart | `formatLabel(iso, "7d")`      | `{line1: "lun.", line2: "03"}`         |
| HistoryBarChart | `formatLabel(iso, "30d")`     | `{line1: "DD/MM"}` (e.g. `12/02`)      |
| WeatherPanel    | `<WindArrow angle={0}>`       | rotated 0° (points up = North)         |
| WeatherPanel    | `<WindArrow angle={90}>`      | rotated 90° (points right = East)      |
| WeatherPanel    | `<WindArrow angle={null}>`    | renders nothing (no SVG)               |

### Not tested (UI-only, no business logic)

- `WeatherStationWidget` layout (visual; covered by manual review).
- `WeatherDetailContent` mapping (trivial mapping over bindings).
- `MobileWidgetCard` weather branch (string concat on values).

## Release notes draft (FR)

```
- Refonte de l'affichage des stations météo : nouvelle vignette dashboard PC/mobile dédiée, bottom sheet enrichie au tap mobile, pluie 24h visible partout, panneau détail avec flèche directionnelle pour le vent et tendance de pression.
- Histogramme : étiquettes plus lisibles sur 7j (jour de la semaine + numéro) et 30j (format compact `JJ/MM`), échelle responsive sur mobile.
```

## Release notes draft (EN)

```
- Weather station UI rework: dedicated dashboard widget (PC & mobile), richer bottom sheet on tap, 24 h rain visible everywhere, detail panel now shows a wind direction arrow and a 3 h pressure trend.
- History bar chart: more readable labels on 7-day (weekday + day) and 30-day (compact `DD/MM`) ranges, responsive scale on mobile.
```
