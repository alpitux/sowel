# Spec 098 — Design System Phase 4: Dashboard Widgets

> Light scoping spec — part of the [094 UI redesign umbrella](../094-ui-redesign/spec.md). Expanded into full spec when picked up via `/sowel-feature`.

## Problem

Dashboard widgets work but diverge slightly from the design system: radius is `10px` (arbitrary, set at first dashboard release) while the system targets `--r-md` (8 px). Widget anatomy isn't formalized as BEM. The SVG icons in `WidgetIcons.tsx` are already production-aligned (validated against the polished mock).

## Goal

Align widget chrome with [design-system/components/dashboard-widget.md](../../design-system/components/dashboard-widget.md): snap radius from `10px` to `--r-md`, formalize `.widget`, `.widget__title`, `.widget__art`, `.widget__big`, `.widget__footer` as BEM classes. Verify tabular nums on energy values.

## In scope

- Refactor `ui/src/components/dashboard/WidgetCard.tsx` to use BEM classes.
- Snap `border-radius: 10px` → `var(--r-md)` (8 px).
- Verify each widget type (~21 types) renders correctly after refactor — no visual regression except the radius.
- Confirm tabular nums on energy / temperature values.

## Out of scope

- SVG icon changes (already aligned in `WidgetIcons.tsx`).
- New widget types.
- Dashboard layout / drag-drop / reorder logic.

## Acceptance criteria

- [ ] `.widget`, `.widget__title`, `.widget__art`, `.widget__footer` present
- [ ] Border radius = `var(--r-md)` everywhere on widgets
- [ ] Visual diff limited to the radius (no other regressions)
- [ ] Energy values use tabular nums (no jitter)

## References

- [design-system/components/dashboard-widget.md](../../design-system/components/dashboard-widget.md)
- [design-system/migration.md](../../design-system/migration.md) Phase 4
- [ui/src/components/dashboard/WidgetIcons.tsx](../../ui/src/components/dashboard/WidgetIcons.tsx)
