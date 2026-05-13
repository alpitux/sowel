# Spec 096 — Design System Phase 2: Sidebar

> Light scoping spec — part of the [094 UI redesign umbrella](../094-ui-redesign/spec.md). Expanded into full spec when picked up via `/sowel-feature`.

## Problem

The sidebar nav is the most visible element of the app. Today it uses ad-hoc Tailwind utilities composed inline; hover states are inconsistent; the Modes icon is `ToggleRight` (not semantic). The Énergie / Modes / Analyse grouping isn't visually separated.

## Goal

Adopt the `.sb__*` BEM pattern documented in [design-system/components/sidebar-nav.md](../../design-system/components/sidebar-nav.md). Add separator rules around Modes/Analyse/Énergie. Replace the Modes icon with `Layers`.

## In scope

- Refactor `ui/src/components/layout/Sidebar.tsx` to use `.sb__item` / `.sb__item--active`.
- Add `.sb__group` divider before Modes and Énergie groups.
- Swap Modes icon: `ToggleRight` → `Layers` (Lucide).
- Verify mobile burger menu still uses the same items.

## Out of scope

- Reordering tabs (current order is correct per production reference).
- Reworking the topbar (separate concern).

## Acceptance criteria

- [ ] `.sb__item`, `.sb__item--active`, `.sb__group` classes present in `Sidebar.tsx`
- [ ] Modes icon is `Layers`
- [ ] Visible separators around Énergie and Modes groups
- [ ] Mobile menu identical in behavior

## References

- [design-system/components/sidebar-nav.md](../../design-system/components/sidebar-nav.md)
- [design-system/migration.md](../../design-system/migration.md) Phase 2
