# Spec 106 — Implementation plan

UI-only feature, single branch `feat/updates-sheet`.

## Tasks

1. [x] Create `ui/src/components/layout/UpdatesSheet.tsx`
   - Copy `AlarmsSheet` structure (BottomSheet + list)
   - Header icon: `RefreshCw`, tint `text-error`
   - On open: fetch `getPlugins()` and filter `latestVersion != null`
   - Render core row first (if `updateAvailable !== null`)
   - Render one row per outdated plugin
   - Empty state when nothing to update (placeholder text)
   - `UpdateRow` sub-component: title + optional Recipe/Integration badge, `vCurrent → vLatest`, Update button with inline `Loader2` spinner while pending
   - Core update: `triggerSystemUpdate()` → `setUpdateInProgress(true)` → `onClose()`
   - Plugin update: `updatePlugin(id)` → 1.5 s wait → drop row from local state → `refreshPluginUpdateCount()`
2. [x] Edit `ui/src/components/layout/AppLayout.tsx`
   - Add `updatesOpen` state next to `alarmsOpen`
   - Replace `href="/plugins"` on the updates `HeaderPill` with `onClick={() => setUpdatesOpen(true)}`
   - Render `<UpdatesSheet open={updatesOpen} onClose={() => setUpdatesOpen(false)} />` next to `<AlarmsSheet ...>`
3. [x] Add i18n keys in `ui/src/i18n/locales/fr.json` and `en.json`:
   - `updates.sheet.title`
   - `updates.sheet.empty`
   - `updates.sheet.versions` (e.g. `"v{{from}} → v{{to}}"`)
   - `updates.action.update`
   - `updates.badge.integration`
   - `updates.badge.recipe`
   - `updates.error.generic`
4. [x] `npx tsc --noEmit` + `cd ui && npx tsc -b --noEmit`
5. [x] `npx eslint src/ --ext .ts && cd ui && npx eslint .`
6. [x] `npx vitest run` — no backend changes so no new tests; existing suite must stay green
7. [ ] Visual check on local dev or demo: pill click opens sheet, both row types update correctly _(pending — no updates available on local; verify on demo or prod after deploy)_

## Test plan

Pure UI work, no business logic to unit-test (CLAUDE.md: "What NOT to test: UI components"). The verification matrix from `spec.md` § Test plan is the manual checklist driving step 7 above:

| Scenario                                     | Expected                                                                                        |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `updateAvailable != null`, no plugin updates | Sheet shows 1 row "Sowel vX → vY"; Update closes sheet and triggers `UpdateOverlay`             |
| 2 plugin updates, no core update             | Sheet shows 2 rows; each Update button works; rows disappear on success; pill counter decreases |
| Core + 1 plugin                              | Core row first, then plugin row                                                                 |
| `totalUpdates === 0`                         | Pill not rendered (unchanged behaviour from current AppLayout)                                  |
| Click on pill                                | Sheet opens (no route change), backdrop click closes, X button closes, ESC closes               |
| Alarms pill still works                      | Independent sheet, no z-index clash                                                             |

Backend unit tests untouched (none of the changed files have associated tests).
