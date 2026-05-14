# Plan — Spec 098 — Dashboard Widget Chrome

## Implementation steps

1. **Branch**: `git checkout -b feat/design-system-dashboard`
2. **Create `WidgetCard.tsx`** in `ui/src/components/dashboard/` with the typed shell + 17 px title + `rounded-md` chrome.
3. **Update `ui/src/index.css`** `@theme`: `--radius-md: 10px` → `8px`.
4. **Refactor `EquipmentWidget.tsx`**:
   - Remove the local `WidgetCard` (lines 85-96).
   - Import the shared `WidgetCard`.
   - Read line ~485 in context — decide whether to wrap with `WidgetCard` (preferred) or only update the radius literal.
5. **Refactor `WeatherForecastWidget.tsx`** (line 54): replace the inline chrome div + inline title span with `<WidgetCard label={label}>…children…</WidgetCard>`.
6. **Refactor `ZoneWidget.tsx`** (line 144): same pattern.
7. **Update `design-system/components/dashboard-widget.md`** CSS snippet: `border-radius: 10px` → `border-radius: var(--r-md)`.
8. **Validate** (Gate 4): `npx tsc --noEmit` (both), `cd ui && npm run build`, `npx vitest run`, `npx eslint src/ --ext .ts`.
9. **Commit** with conventional message: `feat(ui): unify dashboard widget chrome and align radius (spec 098)`.
10. **Open PR** with a short before/after summary.

## Test plan

### Modules touched

- `ui/src/components/dashboard/WidgetCard.tsx` (new — JSX only)
- `ui/src/components/dashboard/EquipmentWidget.tsx` (refactor — composition only)
- `ui/src/components/dashboard/WeatherForecastWidget.tsx` (refactor)
- `ui/src/components/dashboard/ZoneWidget.tsx` (refactor)
- `ui/src/index.css` (1 token update)
- `design-system/components/dashboard-widget.md` (doc)

### Why no unit tests

Per CLAUDE.md "no React tests in this project". This is a chrome refactor — no business logic, no state machine, no data transformation. The widget data flow (binding manager, equipment store, websocket updates) is untouched.

The existing Vitest suite (429 tests) must continue to pass — none of these tests exercise widget rendering.

### Manual verification scenarios

| Scenario                                            | Expected                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------ |
| Desktop dashboard with one of every widget type     | All widgets render with `rounded-md` (= 8 px), 240 px height, identical layout |
| Mobile dashboard                                    | Mobile widgets unchanged (already 8 px)                                        |
| Edit mode — drag handle, customize button, delete   | Edit overlay still renders correctly on top of `WidgetCard`                    |
| Click a widget                                      | Existing click behavior preserved (navigate to detail / sheet)                 |
| Weather forecast widget with no data                | Renders nothing (existing null-guard preserved)                                |
| Zone widget with sensors                            | Renders aggregated data unchanged                                              |
| Equipment widget — light, on / off / dim            | All three light states render correctly inside the new `WidgetCard`            |
| Equipment widget — shutter, open / closed / partial | Three position states render correctly                                         |
| Equipment widget — thermostat                       | Temperature + ± controls render correctly                                      |
| Equipment widget — pool pump on with runtime        | Power button + runtime display intact                                          |
| Settings → tariff editor                            | Inputs and buttons now use 8 px radius (visible 2 px tightening)               |
| Dark mode toggle                                    | All widgets adapt — chrome border + bg follow design system tokens             |

## Tasks

- [x] Branch `feat/design-system-dashboard` created
- [x] `WidgetCard.tsx` created with typed props (label, className, onClick, children)
- [x] `ui/src/index.css` `@theme` updated to `--radius-md: 8px`
- [x] `EquipmentWidget.tsx` local `WidgetCard` removed, shared import used
- [x] `EquipmentWidget.tsx` gate variant migrated to `WidgetCard` (onClick + className forwarded)
- [x] `WeatherForecastWidget.tsx` uses `WidgetCard`
- [x] `ZoneWidget.tsx` uses `WidgetCard` (via existing `ZoneWidgetCard` wrapper)
- [x] `design-system/components/dashboard-widget.md` CSS updated to `var(--r-md)`
- [x] Gate 4 passes (tsc + build + vitest + eslint, 429 tests)
- [ ] Commit on feat branch (no Co-Authored-By)
- [ ] PR opened
- [ ] User approval before merge
