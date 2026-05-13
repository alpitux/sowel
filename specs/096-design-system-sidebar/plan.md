# Plan — Spec 096 — Sidebar refactor

## Implementation steps

1. **Branch**: `git checkout -b feat/design-system-sidebar`
2. **Capture baseline screenshots** (optional, deferred to PR review): sidebar in light + dark, collapsed + expanded, on each top-level route.
3. **Create `SidebarItem.tsx`** with the typed props from architecture.md. Single source of truth for the hover/active class chain.
4. **Create `SidebarSeparator.tsx`** (trivial, 1-liner).
5. **Create `SidebarSectionHeader.tsx`** for the uppercase-small-caps section heads.
6. **Refactor `Sidebar.tsx`** section by section, top-down:
   - Dashboard → `<SidebarSectionHeader>` (no expand)
   - Maison → `<SidebarSectionHeader expandable>` + `<SidebarZoneTree />` (untouched)
   - Modes → `<SidebarSectionHeader expandable>` + `<SidebarModeList />` (untouched)
   - Analyse → `<SidebarSectionHeader expandable>` + `<SidebarChartList />` (untouched)
   - Énergie → `<SidebarSectionHeader expandable>` + sub-`<SidebarItem>` for Live / Consumption / Production
   - Admin → `<SidebarSectionHeader expandable>` + `ADMIN_ITEMS.map(...)` rendered as `<SidebarItem>`
   - Réglages → `<SidebarSectionHeader>` (no expand)
   - Collapse toggle → kept as bare `<button>` (no semantic match)
7. **Verify hover refinement**: apply `hover:bg-background` everywhere. Confirm in dev that hover is visibly distinct from default but not aggressive.
8. **Verify line count**: `wc -l Sidebar.tsx` should be under 280.
9. **Run dev server** (`cd ui && npm run dev`), navigate through every section, verify:
   - All 7 top-level items render
   - Expand chevrons rotate when opened
   - Active state pill follows the route
   - Collapse toggle works and tooltips appear in collapsed mode
   - Plugin update badge appears on `/plugins` (if applicable)
   - Settings update dot appears on Réglages (if applicable)
10. **Validate** (Gate 4): `npx tsc --noEmit` (root + ui), `cd ui && npm run build`, `npx vitest run`, `npx eslint src/ --ext .ts`.
11. **Commit** with conventional message: `feat(ui): refactor sidebar into SidebarItem/Header/Separator components (spec 096)`.
12. **Open PR** with a short before/after diff summary (line counts, hover screenshots).

## Test plan

### Modules touched

- `ui/src/components/layout/SidebarItem.tsx` (new — JSX only, no business logic)
- `ui/src/components/layout/SidebarSectionHeader.tsx` (new — JSX only)
- `ui/src/components/layout/SidebarSeparator.tsx` (new — JSX only)
- `ui/src/components/layout/Sidebar.tsx` (refactor — composition only, no logic change)

### Why no unit tests

Per CLAUDE.md "What NOT to test: UI components (no React tests in this project)". This spec touches only JSX rendering and composition. There is no business logic to unit-test:

- No new state machine — collapse / expand state is preserved verbatim.
- No new data transformations.
- No new event handlers — `onClick` semantics are unchanged.

The existing Vitest suite (429 tests) must continue to pass, since the refactor doesn't reach into any tested module.

### Manual verification scenarios

| Scenario                                       | Expected                                                                          |
| ---------------------------------------------- | --------------------------------------------------------------------------------- |
| User on `/dashboard`                           | Dashboard section header tinted primary; pill `bg-primary-light`                  |
| User on `/home/<zoneId>`                       | Maison section expanded; zone tree rendered; correct leaf zone highlighted        |
| User on `/modes/<modeId>`                      | Modes section expanded; mode list rendered; current mode highlighted              |
| User on `/analyse/<chartId>`                   | Analyse section expanded; chart list rendered                                     |
| User on `/energy/live`                         | Énergie section expanded; Live sub-pill active                                    |
| User on `/energy/production` (with production) | Production sub-pill active                                                        |
| User on `/devices` as admin                    | Administration section expanded; Devices pill active                              |
| User on `/settings`                            | Réglages section header active (no expand)                                        |
| Hover over an unactive item                    | Background fades to `bg-background` (visible neutral)                             |
| Hover over an active item                      | Stays `bg-primary-light` (no flash to neutral)                                    |
| Collapse toggle                                | Sidebar shrinks to 68px; labels disappear; icons remain; tooltips on hover        |
| Auto-expand on navigation                      | Clicking `/modes` from `/dashboard` opens the Modes section automatically         |
| Admin user logs in                             | Administration section visible                                                    |
| Non-admin user logs in                         | Administration section absent                                                     |
| `energyAvailable === false`                    | Énergie section absent                                                            |
| `hasProduction === false`                      | Production sub-pill absent (Live + Consumption only)                              |
| `pluginUpdateCount > 0` (admin only)           | Red badge with count on `/plugins` pill                                           |
| `updateAvailable === true`                     | Red dot on Réglages icon                                                          |
| Dark mode toggle                               | All hover/active states adapt — `bg-background` becomes `var(--n-50)` dark equiv. |
| Resize to mobile (`< 1024px`)                  | Sidebar hides (preserved layout behavior)                                         |

## Tasks

- [x] Branch `feat/design-system-sidebar` created
- [x] `SidebarItem.tsx` created with typed props (59 lines)
- [x] `SidebarSeparator.tsx` created (3 lines)
- [x] `SidebarSectionHeader.tsx` created (130 lines)
- [x] `Sidebar.tsx` refactored — all sections use new components (348 lines, –32%)
- [x] Hover refined to `bg-background`
- [ ] All manual verification scenarios pass (deferred to PR review on dev server)
- [x] Gate 4 passes (tsc + build + vitest + eslint)
- [ ] Commit on feat branch (no Co-Authored-By)
- [ ] PR opened with diff summary + screenshots
- [ ] User approval before merge
