# Spec 098 — Design System Phase 4: Dashboard Widgets

> Phase 4 of the [094 UI redesign umbrella](../094-ui-redesign/spec.md). Aligns the dashboard widget chrome with the design system and unifies desktop/mobile.

## Problem

Dashboard widgets work but diverge from the design system in two small but persistent ways:

1. **Radius**: desktop widgets use `rounded-[10px]` (arbitrary), mobile already uses `rounded-[8px]`. The design system token `--r-md` is 8 px. Phase 0 kept `--radius-md: 10px` in `@theme` with an explicit comment "spec 098 will align to design system".
2. **Chrome duplication**: a `WidgetCard` helper exists inside [EquipmentWidget.tsx](../../ui/src/components/dashboard/EquipmentWidget.tsx) (line 88, local function), but [WeatherForecastWidget.tsx](../../ui/src/components/dashboard/WeatherForecastWidget.tsx), [ZoneWidget.tsx](../../ui/src/components/dashboard/ZoneWidget.tsx), and a secondary variant inside `EquipmentWidget.tsx` (line 485) redefine the same chrome inline. Four sources of truth for one card shell.

Tabular nums are already correctly applied to all energy / temperature / position values (already AAA on this point).

## Goal

1. Extract `WidgetCard` to its own file under `ui/src/components/dashboard/WidgetCard.tsx`.
2. Use it consistently across `EquipmentWidget`, `WeatherForecastWidget`, `ZoneWidget`.
3. Snap widget radius from 10 px to 8 px by updating the `--radius-md` token in `ui/src/index.css` from `10px` to `8px` (aligned with `--r-md` in `design-system/tokens.css`).
4. Update the design system doc [dashboard-widget.md](../../design-system/components/dashboard-widget.md) CSS snippet from `border-radius: 10px` to `border-radius: var(--r-md)` for consistency.

## Non-negotiable constraint

> **All widget data flows and behaviors must remain unchanged.** This spec touches only chrome (radius, factoring) — no changes to per-type rendering, no changes to data binding logic, no changes to dashboard reorder/edit logic.

## In scope

1. New file `ui/src/components/dashboard/WidgetCard.tsx` exporting a shared shell component (title, fixed responsive height, padding, border, radius).
2. Apply `WidgetCard` from `EquipmentWidget` (both line 90 + line 485), `WeatherForecastWidget`, `ZoneWidget`.
3. Update `ui/src/index.css` `@theme`: `--radius-md: 10px` → `8px`.
4. Update widget chrome to use the semantic `rounded-md` class (which now resolves to 8px) instead of `rounded-[10px]` literal.
5. Update design system doc CSS to reference `var(--r-md)` instead of `10px`.

## Out of scope

- SVG icon changes (already production-aligned in `WidgetIcons.tsx`).
- New widget types or variants.
- Dashboard layout / drag-and-drop / reorder logic.
- Edit-mode chrome (controls, drag handle, delete button) — already present, no change.
- Mobile widget (`MobileWidgetCard.tsx`) — already uses `rounded-[8px]`, no change needed.
- Other `rounded-[10px]` literals in popovers (`BindingsPicker.tsx`, `IconPicker.tsx`) — separate concern.
- Widget title size (keep at production 17 px).
- Edit-mode chrome formalization as `.widget__edit-overlay` BEM — production uses a different pattern that works fine.

## Acceptance criteria

- [x] `ui/src/components/dashboard/WidgetCard.tsx` exists and exports a typed component
- [x] `EquipmentWidget` imports the shared `WidgetCard` (no local copy)
- [x] `WeatherForecastWidget` uses the shared `WidgetCard`
- [x] `ZoneWidget` uses the shared `WidgetCard` (via `ZoneWidgetCard` wrapper)
- [x] No `rounded-[10px]` literal remains on widget chrome (4 places eliminated)
- [x] `ui/src/index.css` `@theme` has `--radius-md: 8px`
- [x] `design-system/components/dashboard-widget.md` CSS snippet uses `border-radius: var(--r-md)`
- [x] Type-check, lint, vitest, build all pass (429 tests)
- [ ] Visual diff limited to: widget radius 10 → 8 px, and 4 settings inputs/buttons (TariffSettings) 10 → 8 px (collateral) — verify on running app

## Edge cases

| Case                                             | Expected                                                                         |
| ------------------------------------------------ | -------------------------------------------------------------------------------- |
| Desktop dashboard at 1024 px                     | Widgets render at 240 px height with 8 px radius                                 |
| Mobile dashboard at 390 px                       | `MobileWidgetCard` unchanged (already 8 px)                                      |
| Settings → tariff editor (collateral hit)        | Inputs and buttons now use 8 px corner radius — minor visual change, no behavior |
| Zone widget (data: zone aggregation)             | Uses shared `WidgetCard`, identical visual to before except radius               |
| Weather forecast widget                          | Uses shared `WidgetCard`, identical visual to before except radius               |
| Editing mode (drag handles / customize / delete) | Unchanged — overlays sit on top of `WidgetCard` content                          |
| Equipment widget for each of the ~21 types       | All render via existing per-type renderers wrapping `WidgetCard`                 |

## References

- [design-system/components/dashboard-widget.md](../../design-system/components/dashboard-widget.md)
- [design-system/tokens.md](../../design-system/tokens.md) §4
- [design-system/migration.md](../../design-system/migration.md) Phase 4
- [ui/src/components/dashboard/EquipmentWidget.tsx](../../ui/src/components/dashboard/EquipmentWidget.tsx)
- [ui/src/components/dashboard/WeatherForecastWidget.tsx](../../ui/src/components/dashboard/WeatherForecastWidget.tsx)
- [ui/src/components/dashboard/ZoneWidget.tsx](../../ui/src/components/dashboard/ZoneWidget.tsx)
- [ui/src/components/dashboard/MobileWidgetCard.tsx](../../ui/src/components/dashboard/MobileWidgetCard.tsx) — mobile reference (already at 8 px)
