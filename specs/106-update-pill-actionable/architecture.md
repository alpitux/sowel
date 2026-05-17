# Spec 106 — Architecture

UI-only change. No backend, no database, no event bus, no API additions.

## Components touched

| File                                              | Change                                                                             |
| ------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `ui/src/components/layout/UpdatesSheet.tsx` (new) | Bottom sheet listing core + plugin updates with per-row Update buttons             |
| `ui/src/components/layout/AppLayout.tsx`          | Updates `HeaderPill` swaps `href="/plugins"` for an `onClick` that opens the sheet |
| `ui/src/i18n/locales/{fr,en}.json`                | New `updates.sheet.*` and `updates.action.*` keys                                  |

`HistoryPanel`, `usePluginUpdates`, `useUpdateAvailable`, `BottomSheet`, `triggerSystemUpdate`, `updatePlugin` are reused as-is.

## Data sources

- **Sowel core update**: read directly from `useWebSocket((s) => s.updateAvailable)` —
  shape `{ current, latest, releaseUrl } | null`, already kept fresh by the
  WebSocket push of `system.update.available` (see `useUpdateAvailable`).
- **Outdated plugins**: fetched on sheet open via `getPlugins()`, filtered to
  `latestVersion != null`. The badge counter store (`usePluginUpdates`) only
  tracks the count, so the sheet maintains its own short-lived list state and
  calls `refreshPluginUpdateCount()` after each successful update to keep the
  pill in sync.

## Action wiring

| Action        | Implementation                                                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| Core update   | `triggerSystemUpdate()` → `setUpdateInProgress(true)` → `onClose()`. `UpdateOverlay` takes over the screen. |
| Plugin update | `updatePlugin(id)` → 1.5 s wait (plugin restart) → remove row locally → `refreshPluginUpdateCount()`.       |

Same call sequences used today by `SettingsPage` (core) and `PluginsPage` (plugin).

## State strategy

The sheet keeps three local `useState` slots:

- `plugins: PluginInfo[] | null` — `null` = loading, `[]` = no plugin updates,
  populated array = list of outdated plugins.
- `updatingId: string | null` — id of the row currently updating (or
  `"__core__"` for the core row). Drives per-row spinner + button disabled.
- `error: string | null` — last error message; rendered under the list, never
  blocks other rows.

No new Zustand store. No new event types. Sheet state resets each time it opens
(refetches plugins, clears error) which keeps the implementation trivial.

## Z-index / overlay coexistence

`AlarmsSheet`, `HomeSetupWizard` and `UpdateOverlay` are all rendered at the
end of `AppLayout`. `UpdatesSheet` slots in at the same level after
`AlarmsSheet`. Two sheets cannot be open at once because each pill click closes
the other implicitly only if we wire it — for simplicity, we don't: opening one
just stacks on top of the other (same as today's `AlarmsSheet` behavior).
`UpdateOverlay` (full-screen) renders last and covers everything once a core
update is in progress.

## Out of scope (carried over from spec.md)

- "Update all" button
- Update history surfaced in this UI
- Filter / sort within the sheet
