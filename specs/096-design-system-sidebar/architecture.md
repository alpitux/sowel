# Architecture — Spec 096 — Sidebar refactor

## Overview

Pure UI refactor — no backend, no state changes, no routing changes. The goal is to factor repeated Tailwind class chains in [Sidebar.tsx](../../ui/src/components/layout/Sidebar.tsx) into three React components, and refine hover from invisible-overlay to visible-neutral.

## New components

All three live in [ui/src/components/layout/](../../ui/src/components/layout/) alongside the existing `Sidebar.tsx`.

### `SidebarItem.tsx`

The atomic nav pill. Renders as a `<NavLink>` (active state via `isActive` callback) or a `<button>` (when used for section expand without route nav).

```tsx
interface SidebarItemProps {
  to?: string; // if set, renders as NavLink; else <button>
  label: string; // already-translated label
  icon: ReactNode; // Lucide icon — caller sets size, strokeWidth
  collapsed?: boolean; // when true, hide label, center icon
  active?: boolean; // override (e.g. for ADMIN_ROUTES match)
  badge?: ReactNode; // right-aligned count or dot
  trailing?: ReactNode; // chevron, etc.
  onClick?: (e: MouseEvent) => void;
  end?: boolean; // NavLink `end` prop
  title?: string; // tooltip for collapsed mode
  className?: string; // escape hatch
}
```

Visual states:

| State              | Background                   | Text                  | Icon                             |
| ------------------ | ---------------------------- | --------------------- | -------------------------------- |
| Default            | transparent                  | `text-text-secondary` | `text-text-secondary`            |
| Hover              | **`bg-background`** (new)    | `text-text`           | `text-text`                      |
| Active             | `bg-primary-light`           | `text-primary`        | `text-primary` (font-weight 600) |
| Active hover       | `bg-primary-light` (kept)    | `text-primary`        | `text-primary`                   |
| Active + collapsed | `bg-primary-light` icon-only | —                     | `text-primary`                   |

The hover refinement (`bg-background` instead of `bg-border-light`) is the main visual change. `bg-background` resolves to `var(--n-50)` (#F4F4F5 light, #1F2128 dark) — a clearly visible but understated neutral.

### `SidebarSectionHeader.tsx`

The "uppercase small-caps" pattern used for top-level sections that have a sub-tree (Maison, Modes, Analyse, Énergie, Administration). It's structurally a `SidebarItem` but with different typography (`text-[11px] font-semibold uppercase tracking-wider`).

```tsx
interface SidebarSectionHeaderProps {
  to: string; // primary route (e.g. /modes)
  label: string;
  icon: ReactNode;
  expanded: boolean; // controls chevron direction
  active: boolean; // primary tint when section active
  onClick: (e: MouseEvent) => void;
  badge?: ReactNode;
  collapsed?: boolean;
}
```

When `collapsed === true`, the header degenerates to a plain `SidebarItem` (no chevron, icon-only).

### `SidebarSeparator.tsx`

A 1-liner: `<div className="border-t border-border-light" />` — extracted purely to communicate intent at call sites. Could be inlined but the spec's "Énergie / Modes / Analyse separators" mandate makes the intent worth naming.

## Refactor of `Sidebar.tsx`

Current 511 lines collapse to ~250 by:

1. Replacing each duplicate `<NavLink className={…long chain…}>` with `<SidebarItem to=… label=… icon=… />`.
2. Replacing the ~5 section-header blocks (Dashboard, Maison, Modes, Analyse, Énergie, Administration, Réglages) with `<SidebarSectionHeader …>`.
3. Replacing `<div className="… border-t border-border-light">` patterns with `<SidebarSeparator />`.
4. The collapse/expand state machine, the `ADMIN_ROUTES` matcher, the `usePluginUpdates` hook, the `useEnergy` checks — all kept as-is in `Sidebar.tsx` (not extracted).

## File changes

| File                                                | Change                      |
| --------------------------------------------------- | --------------------------- |
| `ui/src/components/layout/SidebarItem.tsx`          | new — ~80 lines             |
| `ui/src/components/layout/SidebarSectionHeader.tsx` | new — ~60 lines             |
| `ui/src/components/layout/SidebarSeparator.tsx`     | new — ~10 lines             |
| `ui/src/components/layout/Sidebar.tsx`              | refactor — 511 → ~250 lines |

`SidebarZoneTree`, `SidebarModeList`, `SidebarChartList` are **not modified** in this spec. They render their items via their own logic; aligning them with `<SidebarItem>` is deferred to a follow-up (they have heavier per-item behavior).

## Risk assessment

| Risk                                                                         | Likelihood | Mitigation                                                                                                              |
| ---------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| Active state regression on a section (Maison, Modes, etc.)                   | Low        | The `getSectionForPath` matcher is preserved unchanged. Manual verify each route.                                       |
| Collapse mode UX broken                                                      | Low        | `SidebarItem` has an explicit `collapsed` prop. Verify by toggling and navigating in all states.                        |
| NavLink's `isActive` callback doesn't fire because we wrap differently       | Low        | We keep `NavLink` as the underlying element — props are forwarded.                                                      |
| Plugin update badge no longer appears                                        | Low        | Test path: log in as admin → trigger plugin update detection → verify badge renders.                                    |
| Production CSS tokens broken (after Phase 0 swap)                            | Very low   | Already validated by Phase 0 acceptance. Tailwind `bg-background` resolves to `var(--n-50)` which is now defined.       |
| Future component extraction (zone tree, mode list) collides with this design | Medium     | We deliberately scope the new components to be composable. Zone tree etc. will adopt `SidebarItem` in a follow-up spec. |

## Rollback

`git revert` of the commit. The four files are self-contained; no migrations, no API changes, no state.

## References

- [design-system/components/sidebar-nav.md](../../design-system/components/sidebar-nav.md)
- [ui/src/components/layout/Sidebar.tsx](../../ui/src/components/layout/Sidebar.tsx) — current implementation
