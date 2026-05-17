# Spec 106 — Make the topbar "update available" pill actionable

> Light spec: a UX fix for the existing update-notification pill. No
> backend changes. No new APIs. Pure UI plumbing.

## Problem

The topbar shows a pill that aggregates **all** available updates:

```ts
const totalUpdates = pluginUpdateCount + (sowelUpdateAvailable ? 1 : 0);
```

A click on the pill just navigates to `/plugins`. That breaks in two
ways:

1. **Sowel core updates are invisible on `/plugins`.** They are triggered
   from `/settings` → System → "Update Sowel"
   ([SettingsPage.tsx:678](src/pages/SettingsPage.tsx#L678)). A user whose
   only pending update is the core sees "1 update available", clicks,
   lands on `/plugins`, and finds nothing to do.
2. **No "update everything" path.** With N plugins + the core
   outdated, the user navigates to two distinct places and clicks N+1
   times.

The pill's destination should reflect what the pill is counting.

## Goal

Make the pill's click open a single, focused surface that lists every
available update (core + plugins) with a one-click action per row.
Same UX pattern as the **alarms pill**, which opens `AlarmsSheet`.

## Approach

Replace the `href="/plugins"` on the updates `HeaderPill` with an
`onClick` that opens a new `UpdatesSheet` (modeled on `AlarmsSheet`).

`UpdatesSheet` contents (top to bottom):

- **Sowel core**, if `sowelUpdateAvailable`:
  - Title: `Sowel`
  - Subtitle: `vCurrent → vLatest`
  - Action: `Update` button → calls `triggerSystemUpdate()` then sets
    `updateInProgress = true` (same logic as
    [SettingsPage.tsx:677-680](src/pages/SettingsPage.tsx#L677)). The
    sheet stays open until `UpdateOverlay` takes over.

- **One row per outdated plugin** (manifest version ≠ `latestVersion`):
  - Title: plugin name + small `Recipe` / `Integration` badge
  - Subtitle: `vCurrent → vLatest`
  - Action: `Update` button → calls `updatePlugin(id)`. The button shows
    a spinner while the request runs; on success the row is removed
    from the list (or replaced by a "Updated" tag).

- **Empty state**: if for some reason the sheet opens with nothing to
  update (race condition with a just-completed update), show a
  "Everything's up to date" placeholder + close button.

Visual style + animation: copy `AlarmsSheet` 1:1. Bottom-right anchored
on desktop, full-width bottom-sheet on mobile, slide-up animation,
backdrop click-to-close.

## Out of scope

- A bulk "Update all" button (one click per row is fine for now —
  plugins update independently and each takes a few seconds; users
  rarely have more than 2-3 outdated)
- Tracking update history (already in `system.update.progress` event
  trail; not surfaced here)
- Filtering/sorting (sheet is short by definition; ordering is core
  first, then plugins alphabetically)

## Acceptance criteria

- [x] Clicking the topbar updates pill opens a new `UpdatesSheet`
      (not a route change)
- [x] The sheet lists Sowel core first (if outdated) followed by each
      outdated plugin
- [x] Each row has a working `Update` button wired to the right API
      (`triggerSystemUpdate` for core, `updatePlugin` for plugins)
- [x] Triggering a core update closes the sheet and lets
      `UpdateOverlay` take over
- [x] Plugin updates run in-place (sheet stays open, row shows a
      spinner, then disappears on success)
- [x] FR + EN i18n strings under `updates.sheet.*`
- [x] Existing alarms-pill behaviour unchanged

## Test plan

| Module                  | Scenario                                                      | Expected                                                                |
| ----------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `UpdatesSheet` (UI)     | sowelUpdateAvailable = true, no plugin updates                | Sheet shows 1 row "Sowel vX → vY", Update button triggers system update |
| `UpdatesSheet` (UI)     | 2 plugin updates, no core update                              | Sheet shows 2 rows, both Update buttons work, rows disappear on success |
| `UpdatesSheet` (UI)     | core + 1 plugin                                               | Sheet shows core then plugin, ordered                                   |
| `AppLayout` integration | totalUpdates = 0                                              | Pill not rendered                                                       |
| `AppLayout` integration | totalUpdates > 0, click on pill                               | Sheet opens (no route change), close via backdrop or X button           |
| `AppLayout` regression  | alarms pill still works (independent sheet, no z-index clash) | Alarms sheet behaviour unchanged                                        |

## Files touched (estimated)

```
ui/src/components/layout/
  UpdatesSheet.tsx           (new — copy AlarmsSheet structure)
  AppLayout.tsx              (swap href → onClick + render sheet)
ui/src/i18n/locales/
  fr.json, en.json           (updates.sheet.* keys)
```

## Effort

~½ day. Self-contained UI work, no backend.
