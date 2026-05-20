# Spec 114 — Weather station UX

## Problem

The `weather` equipment type (Netatmo and similar multi-module stations) is poorly surfaced across the UI:

- **Dashboard PC widget**: falls through to `SensorEquipmentWidget` (generic). No dedicated layout — typically only the picto and name are shown, not the live values.
- **Dashboard mobile widget**: same generic fallback; tapping it opens a bottom sheet that uses `SensorDetailContent` (flat alias/value list, no module hierarchy).
- **Zone compact card**: filters bindings on a hard-coded list (`temperature`, `sum_rain_24`, `wind_strength`). On real Netatmo data the 24h rain value sometimes ends up missing (binding key drift) and humidity is never shown.
- **Equipment detail (WeatherPanel)**: the `rain` module shows the instantaneous `rain` reading as hero instead of the much more meaningful 24h cumulative. The `wind` module shows no directional indicator.
- **HistoryBarChart**: at 7d/30d ranges the X-axis labels overlap and become unreadable; on mobile the chart is too narrow which makes the issue worse across all ranges (24h, 7d, 30d).

## Goals

1. Treat `weather` as a first-class equipment type in every view (dashboard PC + mobile, zone compact, detail, history chart).
2. Keep widgets 1×1 — no layout footprint change.
3. Surface the 24h rain quantity consistently everywhere.
4. Make the history bar chart readable at every range on every screen size.

## Non-goals

- Forecast equipment (`weather_forecast`) is out of scope — already has its own dedicated widget and panel.
- No backend changes (no new bindings, no new categories, no schema changes).
- No new history aggregation logic — backend already exposes hourly/daily resolutions.
- **Pressure trend (3 h)**: deferred to a follow-up spec. Requires lazy history fetch from inside `WeatherPanel`, which needs an `equipmentId` prop drilled in — bigger surface than this iteration warrants.

## Scope (in / out)

### In scope

| View                       | Change                                                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `MobileWidgetCard.tsx`     | New `weather` case in `useMobileState`: 3-value summary (temp · humidity · rain24h)                                                 |
| `WidgetDetailSheet.tsx`    | New `WeatherDetailContent` rendered before the `isSensor` branch — flat alias/value list of all weather bindings, no modular layout |
| `EquipmentWidget.tsx`      | New `WeatherStationWidget` (PC 1×1): temperature hero + humidity/rain24h/wind list                                                  |
| `CompactEquipmentCard.tsx` | Extend the weather filter to surface 4 values: temp + humidity + rain24h + wind                                                     |
| `WeatherPanel.tsx`         | `rain` module hero = `sum_rain_24` (not `rain`); `wind` module: directional arrow rotated by `wind_angle`                           |
| `HistoryBarChart.tsx`      | 2-line labels for 7d (weekday + day); compact `DD/MM` for 30d; responsive scale (mobile-friendly tick density, rotation, font size) |

### Out of scope

- Forecast widget/panel.
- New bindings or backend computation.
- Wind compass component (we only need a small arrow).
- Min/max temperature over 24h (would require additional history queries — kept for a later spec).

## Acceptance criteria

1. **Mobile dashboard widget**: a weather equipment shows `19° · 54% · 0mm` style summary (or "—" placeholders if bindings missing). Tap opens the bottom sheet.
2. **Mobile bottom sheet**: shows every weather binding as `<alias>` → `<value> <unit>` in a flat readable list (battery row included).
3. **PC dashboard widget**: shows temp in big mono font + 3 secondary rows; widget remains 1×1.
4. **Zone compact card**: 4 inline values; humidity is now present alongside temp/rain24h/wind.
5. **WeatherPanel detail**: rain hero uses `sum_rain_24`; wind module has a small arrow rotated by `wind_angle` (mapping: 0° = North = arrow up).
6. **HistoryBarChart on 7d (rain or any cumulative)**: 7 bars (1d resolution), each labeled on 2 lines (`lun.` / `03`), no overlapping.
7. **HistoryBarChart on 30d**: compact `DD/MM` labels, tick interval picked so ≤ 10 labels show.
8. **HistoryBarChart on mobile (24h / 7d / 30d)**: labels remain readable, no overlap; font size reduced if width < 360px; bars don't squash to invisible.
9. Defensive: if a binding is missing (e.g. no rain module), placeholders ("—") render instead of empty space; no crash.

## Edge cases

- Equipment with only outdoor module (no rain, no wind): widget shows temp/humidity, "—" for rain/wind.
- Empty history (new install): chart shows existing "Aucune donnée" placeholder unchanged.
- Wind angle 0 vs missing: 0° = a real value (North); `null`/`undefined` = no arrow.
- Mobile portrait at 320px viewport: chart must remain usable (small font + maybe rotated labels).
- `sum_rain_24` binding absent on a station that uses a different key: compact card shows "—" rather than nothing.

## Stations covered

Primary target: **Netatmo Weather Station** (`sum_rain_1`, `sum_rain_24`, `wind_strength`, `wind_angle`, `gust_strength`, `gust_angle`, `temperature`, `humidity`, `pressure`, `noise`, `co2`).

The KEY_LABELS / KEY_ORDER tables in `WeatherPanel.tsx` already encode this naming. Other stations (ecowitt, weatherflow, etc.) will degrade gracefully via the `DataCategory` resolution path.
