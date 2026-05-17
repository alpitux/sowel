# Spec 107 — Surface a changelog link per row in the UpdatesSheet

> Light spec: a follow-up to spec 106. No backend changes. Pure UI plumbing
>
> - one URL convention.

## Problem

`UpdatesSheet` (spec 106, shipped in v1.9.0) lists Sowel core and outdated
plugins with a one-click `Update` button per row. The button is fine, but
the user clicks it blind — there is no way to see _what changed_ between
the current and the proposed version. The only path today is:

1. Remember the version numbers shown in the row (`v1.8.1 → v1.9.0`).
2. Leave Sowel, open a browser tab.
3. Navigate to `docs.sowel.org/release-notes` for the core, or hunt down
   the plugin's GitHub repo for plugins.
4. Scroll until the right version block is found.

Three steps, one of which leaves the product. We just published a
canonical release-notes page on docs.sowel.org and a registry that
already knows where each plugin lives — we can make this one click.

## Goal

Add a discreet link next to each row's `Update` button that opens the
relevant changelog in a new tab. Same row, same affordance, no layout
change.

## Approach

For each `UpdateRow` in `UpdatesSheet`, render an icon-button immediately
before the `Update` button:

- **Icon**: `FileText` from Lucide (or `BookOpen` — keep one and document
  it). 14 px, stroke 1.5, tint `text-text-tertiary` (matches the existing
  pill secondary).
- **Aria/title**: `t("updates.action.viewChangelog", { from, to })` →
  `"View changes (v1.8.1 → v1.9.0)"` / `"Voir les changements (v1.8.1
→ v1.9.0)"`.
- **Behaviour**: `<a target="_blank" rel="noopener noreferrer">` with the
  URL resolved as below.

### URL resolution

| Row kind                 | URL pattern                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core`                   | `https://docs.sowel.org/release-notes/#v<to-with-dashes>` (e.g. `#v1-9-0`). Anchors are made stable by adding explicit `{ #v1-9-0 }` attributes after each version heading in `docs/release-notes.md` and `docs/release-notes.fr.md` (the `attr_list` extension is already enabled in `mkdocs.yml`). Without this, MkDocs auto-slugifies dotted version + date together into something like `v190-2026-05-17` which is hard to compute from the row data. |
| `integration` / `recipe` | `https://github.com/<owner>/<repo>/releases/tag/v<to>`. `owner` and `repo` are derived from the `manifest.repo` field already exposed in the registry (e.g. `mchacher/sowel-plugin-zigbee2mqtt`).                                                                                                                                                                                                                                                         |

Fallback for plugins without a `repo` field: hide the link button for
that row only (keep the row otherwise functional).

### Empty-state behaviour

When the sheet is in the empty / loading / error state, no rows are
rendered, so no link to worry about.

## Out of scope

- Inline changelog rendering inside the sheet — keep the click-out flow.
  We'd otherwise have to fetch and parse the release notes per row, which
  adds a network call and a markdown renderer for marginal benefit.
- Linking from individual plugin cards on `/plugins` — separate UX touch,
  could be a follow-up.
- Linking from the Sowel `/settings` update card — also separate (a
  permanent "What's new in v1.9.0?" link in the topbar could come next).

## Acceptance criteria

- [x] Every `UpdateRow` in `UpdatesSheet` shows a changelog link before
      the Update button (except plugins with no `repo`).
- [x] Clicking the link opens a new tab to the right URL (verified for
      both core and plugin rows).
- [x] The link is disabled while the row is updating (visually muted +
      not focusable) to avoid context switch mid-action.
- [x] FR + EN i18n string for the link tooltip.
- [x] Existing v1.9.0 behaviour of the Update button is preserved.

## Test plan

| Scenario                            | Expected                                                        |
| ----------------------------------- | --------------------------------------------------------------- |
| Core row, click changelog           | New tab opens at `https://docs.sowel.org/release-notes/#v<to>`  |
| Plugin with `repo`, click changelog | New tab opens at `https://github.com/<repo>/releases/tag/v<to>` |
| Plugin without `repo`               | Changelog button not rendered; Update button still works        |
| Row currently updating              | Changelog button disabled (no focus, muted)                     |
| Anchor coverage on docs.sowel.org   | Manual check that `#v1-9-0` etc. resolve to the right section   |

## Files touched (estimated)

```
ui/src/components/layout/UpdatesSheet.tsx   (add icon button + URL resolver)
ui/src/i18n/locales/fr.json                 (updates.action.viewChangelog)
ui/src/i18n/locales/en.json                 (updates.action.viewChangelog)
```

## Effort

~½ day, UI-only. Existing `manifest.repo` field is already exposed in
`PluginInfo`; the docs page anchors are already generated. No backend
work.
