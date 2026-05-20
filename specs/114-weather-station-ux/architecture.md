# Spec 114 — Architecture

## Files changed

| File                                                | Change type | Description                                                                                      |
| --------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------ |
| `ui/src/components/dashboard/MobileWidgetCard.tsx`  | modify      | Add weather branch in `useMobileState` returning {icon, stateLines} for weather equipments.      |
| `ui/src/components/dashboard/WidgetDetailSheet.tsx` | modify      | Add `WeatherDetailContent` component and a `weather` branch dispatched before `isSensor`.        |
| `ui/src/components/dashboard/EquipmentWidget.tsx`   | modify      | Add `WeatherStationWidget` and dispatch on `equipment.type === "weather"` before `isSensor`.     |
| `ui/src/components/home/CompactEquipmentCard.tsx`   | modify      | Widen the `weather` filter to include `humidity` (4 visible values).                             |
| `ui/src/components/equipments/WeatherPanel.tsx`     | modify      | Wind arrow component, pressure trend rendering, swap rain `PRIMARY_KEY`.                         |
| `ui/src/components/history/HistoryBarChart.tsx`     | modify      | Responsive tick interval + label formatter (2-line for 7d, compact for 30d, mobile breakpoints). |
| `ui/src/components/history/HistoryBarChart.test.ts` | new         | Unit tests for tick interval picker and label formatter.                                         |
| `ui/src/components/equipments/WeatherPanel.test.ts` | new (small) | Unit test for wind arrow direction mapping (0°/90°/180°/270°).                                   |

No backend changes. No new types. No new translation keys (existing `weather.*` keys are sufficient).

## Component contracts

### `useMobileState` — new weather branch

```ts
if (equipment.type === "weather") {
  const findVal = (key: string) =>
    equipment.dataBindings.find(b => b.key === key)?.value;
  const lines: string[] = [];
  const t = findVal("temperature");
  const h = findVal("humidity");
  const r = findVal("sum_rain_24");
  if (typeof t === "number") lines.push(`${t.toFixed(1)}°`);
  if (typeof h === "number") lines.push(`${Math.round(h)}%`);
  if (typeof r === "number") lines.push(`${r.toFixed(1)}mm`);
  return { icon: <WeatherStationIcon />, stateLines: lines };
}
```

Icon: a CloudRain-Thermometer hybrid inline SVG (Lucide-style stroke 1.5px).

### `WeatherDetailContent` (bottom sheet)

Flat list, mirroring the layout already used in `SensorDetailContent` but with weather-aware labels via `KEY_LABELS` from `WeatherPanel.tsx`:

```tsx
<div className="divide-y divide-border-light">
  {bindings.map((b) => (
    <div className="flex justify-between py-2">
      <span className="text-[13px] text-text-secondary">
        {KEY_LABELS[b.key] ? t(KEY_LABELS[b.key]) : b.key}
      </span>
      <span className="font-mono text-[14px] tabular-nums">
        {format(b.value)} <span className="text-text-tertiary">{b.unit}</span>
      </span>
    </div>
  ))}
</div>
```

### `WeatherStationWidget` (PC dashboard)

```
┌─────────────────────────┐
│ STATION MÉTÉO           │
│                         │
│ [icon] 19.2°            │
│                         │
│ Humidité     54 %       │
│ Pluie 24h    0 mm       │
│ Vent         12 km/h    │
└─────────────────────────┘
```

Uses `WidgetCard` shell. Hero pulled from `temperature` binding, secondary rows from `humidity` / `sum_rain_24` / `wind_strength` with graceful fallback ("—").

### `WeatherPanel` enrichments

1. `PRIMARY_KEY.rain` changes from `"rain"` → `"sum_rain_24"` (one-line constant edit).
2. New `<WindArrow angle={value} size={18} />` rendered inline next to the wind hero. Rotation: `transform: rotate(${angle}deg)`. Arrow base points "up" (= North = 0°).
3. New optional `<PressureTrend bindingKey="pressure" />` row added to the outdoor module secondary list. Reads history via the same history endpoint already used by `HistoryPanel` (1h resolution, 3-point lookback). If no history → no row. Implementation detail: a small `useHistoryDelta(alias, "3h")` hook that returns ↑/↗/→/↘/↓ based on slope thresholds.

### `HistoryBarChart` — label & scale logic

New helper functions inside the file:

```ts
function pickTickInterval(count: number, viewportWidth: number): number {
  const maxLabels = viewportWidth < 360 ? 6 : viewportWidth < 640 ? 8 : 12;
  if (count <= maxLabels) return 0;
  return Math.max(1, Math.floor(count / maxLabels)) - 1;
}

function formatLabel(iso: string, range: TimeRange): { line1: string; line2?: string } {
  const d = new Date(iso);
  if (range === "6h" || range === "24h") {
    return { line1: d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) };
  }
  if (range === "7d") {
    return {
      line1: d.toLocaleDateString("fr-FR", { weekday: "short" }),
      line2: String(d.getDate()).padStart(2, "0"),
    };
  }
  // 30d
  return {
    line1: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
  };
}
```

Render: when `line2` is present, use Recharts `<XAxis tick={<CustomTick />}>` with a custom React component that renders two `<text>` elements stacked.

Mobile font size: read `window.matchMedia` or rely on Tailwind responsive utilities; in practice we pass `tickFontSize` derived from viewport width into the chart props.

### Data flow

No event-bus changes. All reads come from the equipment `dataBindings` that are already fed by `WebSocket`. The pressure trend hook hits the existing `/api/v1/history/...` endpoint already used by `HistoryPanel`.
