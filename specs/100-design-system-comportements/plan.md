# Plan — Spec 100 — Zone View 2-Column Layout

## Implementation steps

1. **Branch**: `git checkout -b feat/design-system-zone-2col-layout`
2. **Edit `ui/src/pages/HomePage.tsx`** (lines ~137 and ~176):
   - Bump hero block from `max-w-[720px]` → `max-w-[1200px]`
   - Replace wrapper `<div className="max-w-[720px] space-y-6">` with `<div className="max-w-[1200px] grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6">`
   - Wrap the Comportements `CollapsibleSection` in `<div className="space-y-6">` (right column)
   - Add `{/* TODO spec 101: ActivityPanel slot */}` comment as placeholder
3. **Visual verification via Playwright** (dev server should still be running from spec 099):
   - Desktop 1440 × 900 — Séjour: side-by-side Équipements + Comportements
   - Mobile 390 × 844 — Séjour: stacked, Équipements first
   - Tablet 768 × 1024 — Séjour: stacked (not 2-col)
   - Resize while on a zone — layout switches cleanly
4. **Validate** (Gate 4): `npx tsc --noEmit` (both), `cd ui && npm run build`, `npx vitest run`, `npx eslint src/ --ext .ts`.
5. **Commit** with conventional message.
6. **Open PR** with desktop + mobile + tablet screenshots.

## Test plan

### Modules touched

- `ui/src/pages/HomePage.tsx` — wrapper layout only

### Why no unit tests

Per CLAUDE.md "no React tests in this project". This is a wrapper className change — no logic touched. Existing Vitest suite (429 tests) must continue to pass.

### Manual verification scenarios

| Scenario                                                          | Expected                                                                  |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Desktop 1440 px — Séjour (with equipments + modes + recipes)      | Équipements left (~60% width), Comportements right (~40%), gap ~24 px     |
| Desktop 1440 px — Zone with no Modes/Recettes                     | Right column empty (or just the placeholder comment) — layout still 2-col |
| Desktop 1024 px (lg breakpoint exactly)                           | 2-col activates                                                           |
| Tablet 768 px                                                     | Single column, stacked                                                    |
| Mobile 390 px — Séjour                                            | Single column: Équipements full-width, then Comportements below           |
| Mobile — collapsed Équipements                                    | Comportements appears below the chevron, doesn't overlap                  |
| Resize from 1440 → 390 px live                                    | Layout reflows cleanly, no flicker, no state loss                         |
| Long zone name (e.g. "Salle de bain principale extérieure")       | H1 truncates, doesn't break hero                                          |
| Zone with 30+ equipments                                          | Left column natural overflow, page scrolls; right column not stretched    |
| Dark mode                                                         | Layout identical, themes unchanged                                        |
| Sidebar collapsed (68 px)                                         | More content width, layout adapts naturally                               |
| `CollapsibleSection` expand/collapse state persists across reload | Yes (storageKey preserved)                                                |

## Tasks

- [x] Branch `feat/design-system-zone-2col-layout` created
- [x] `HomePage.tsx` hero block max-width bumped to 1200 px
- [x] `HomePage.tsx` content wrapper switched to responsive grid (`grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6`)
- [x] Right column wrapped in `<div className="space-y-6">`, placeholder for ActivityPanel added
- [x] Playwright visual: desktop 1440px (2-col), mobile 390px (stacked)
- [x] Gate 4 passes (tsc + build + vitest + eslint, 429 tests)
- [ ] Commit on feat branch (no Co-Authored-By)
- [ ] PR opened with screenshots
- [ ] User approval before merge
