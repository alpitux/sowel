# Plan — Spec 094 — UI Redesign (Phase 0 palette swap)

## Implementation steps

1. **Branch**: `git checkout -b feat/design-system-palette`
2. **Capture baseline screenshots** (before): Dashboard, Zone view (`Séjour`), Énergie, Modes, Settings, Login — in both **light** and **dark** modes. Save to `specs/094-ui-redesign/screenshots/before/`.
3. **Patch `design-system/tokens.css`**: extend the dark selector from `[data-theme="dark"]` to `[data-theme="dark"], .dark`.
4. **Patch `ui/src/index.css`**:
   - Add `@import "../../design-system/tokens.css";` after `@import "tailwindcss";`
   - Rewrite the `@theme` block — replace every hex literal with `var(--*)` per the mapping table in [design-system/migration.md](../../design-system/migration.md) §5
   - Remove the legacy `.dark { ... }` block (now provided by `tokens.css`)
5. **Run dev server**: `cd ui && npm run dev`. Verify:
   - App boots without console errors
   - Light mode looks like the polished mock's `data-theme="hybrid"`
   - Dark mode looks like the polished mock's `data-theme="dark"`
   - Switching `light | dark | system` in Settings flips the palette
6. **Capture validation screenshots** (after): same set as step 2. Save to `specs/094-ui-redesign/screenshots/after/`.
7. **Hex audit**: `grep -rEn '#[0-9A-Fa-f]{3,6}' ui/src/**/*.tsx ui/src/**/*.ts` — review each remaining literal. Most should be in equipment-type icon definitions or chart components (acceptable for this phase; deferred to phase 5). Document each escape in a comment in the PR body.
8. **Validate** (Gate 4): `npx tsc --noEmit` (root + ui), `cd ui && npm run build`, `npx vitest run`, `npx eslint src/ --ext .ts`.
9. **Commit** with conventional message: `feat(ui): swap palette to design system tokens (spec 094 phase 0)`.
10. **Open PR** with before/after screenshots embedded in the body.

## Test plan

### Modules touched

- [ui/src/index.css](../../ui/src/index.css) — `@theme` rewrite, dark block removed
- [design-system/tokens.css](../../design-system/tokens.css) — dark selector extension

No backend code, no React code, no business logic. **Tests are visual + build-level**, not unit tests.

### Scenarios

| Module     | Scenario                                     | Expected                                                                 | How to verify                                          |
| ---------- | -------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------ |
| Build      | Vite build succeeds                          | Zero errors                                                              | `cd ui && npm run build`                               |
| Build      | Backend `tsc` passes                         | Zero errors                                                              | `npx tsc --noEmit`                                     |
| Build      | UI `tsc` passes                              | Zero errors                                                              | `cd ui && npx tsc -b --noEmit`                         |
| Build      | ESLint passes                                | Zero errors (warnings tolerated)                                         | `npx eslint src/ --ext .ts`                            |
| Backend    | Existing Vitest suite still green            | All tests pass                                                           | `npx vitest run`                                       |
| Theme      | Light mode renders new palette               | Body text `--n-700`, primary `--p-500`                                   | Devtools: inspect computed styles                      |
| Theme      | Dark mode renders new dark palette           | `.dark` class applied → tokens.css `[data-theme="dark"], .dark` triggers | Toggle in Settings → Apparence                         |
| Theme      | System mode follows OS                       | Flips palette when OS theme changes                                      | macOS System Settings → Appearance → toggle Light/Dark |
| Theme      | No flash on load                             | Initial render uses correct palette                                      | Reload page in each mode, check first paint            |
| Visual     | Dashboard renders without console errors     | Clean console                                                            | Open `/` and inspect console                           |
| Visual     | Zone view renders without console errors     | Clean console                                                            | Open a zone, inspect                                   |
| Visual     | Énergie page renders without console errors  | Clean console                                                            | Open `/energy`, inspect                                |
| Visual     | Login page renders without console errors    | Clean console                                                            | Sign out, inspect login                                |
| Regression | No JSX uses a stale hex literal that escapes | Hex audit list is empty or annotated                                     | Grep + manual review                                   |

### Side-by-side acceptance gate

Before merging, the PR body must show before/after screenshots for at least:

1. Dashboard (light + dark)
2. Zone view (light + dark)
3. Énergie (light + dark)
4. Settings (light)
5. Login (light)

The diff is **expected** — it is the palette refinement. Reviewer judges whether the diff matches the design-system reference mock.

## Tasks

- [x] Branch `feat/design-system-palette` created
- [ ] Baseline screenshots captured (`before/`) — skipped; visual verification deferred to PR review
- [x] `tokens.css` dark selector extended
- [x] `index.css` import added
- [x] `index.css` `@theme` rewritten to use `var(--*)`
- [x] `index.css` legacy `.dark` block removed (SVG-boost rule preserved outside @theme)
- [ ] Validation screenshots captured (`after/`) — deferred to PR review
- [x] Hex audit done — only chart-specific and SVG-art literals remain (out of scope per design-system migration §6)
- [x] Gate 4 passes (tsc + build + vitest + eslint)
- [ ] Commit on feat branch (no Co-Authored-By)
- [ ] PR opened with screenshots
- [ ] User approval before merge

## Subsequent phases

After this spec ships, pick up phases in this recommended order via `/sowel-feature`:

1. **096-design-system-sidebar** (fast win, low risk)
2. **097-design-system-strip-pills** (clusters + alert variant)
3. **098-design-system-dashboard** (radius alignment)
4. **095-design-system-typography** (in parallel — invisible polish)
5. **099-design-system-equipment-row** (long pole — one PR per equipment type)
6. **100-design-system-comportements** (panel merge)
7. **101-design-system-activity-feed** (additive)
8. **102-design-system-recipe-modal** (only one with backend impact)
