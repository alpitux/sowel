# Spec 107 — Architecture

UI-only change plus a small docs tweak to lock the anchor format. No backend, no database, no event bus, no API additions.

## Files touched

| File                                                | Change                                                                                     |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `ui/src/components/layout/UpdatesSheet.tsx`         | New `<a>` icon-button before each row's Update button + URL resolver                       |
| `ui/src/i18n/locales/{fr,en}.json`                  | `updates.action.viewChangelog` with `{{from}}`/`{{to}}` interpolation                      |
| `docs/release-notes.md`, `docs/release-notes.fr.md` | Add explicit `{ #v<x>-<y>-<z> }` attribute after every version heading (no content change) |

The release notes content is unchanged, only the heading anchors gain
deterministic IDs. `attr_list` is already enabled in `mkdocs.yml`.

## URL resolution helper

A pure function inside `UpdatesSheet.tsx` (no need for a utility module):

```ts
function changelogUrl(
  kind: "core" | PackageType,
  repo: string | undefined,
  to: string,
): string | null {
  if (kind === "core") {
    return `https://docs.sowel.org/release-notes/#v${to.replaceAll(".", "-")}`;
  }
  if (!repo) return null;
  return `https://github.com/${repo}/releases/tag/v${to}`;
}
```

`null` means "no link to show" — the icon button is simply not rendered
for that row. Only happens for plugins whose registry entry omits the
`repo` field.

## Why a deterministic anchor

Without `attr_list`, MkDocs Material slugifies `### v1.9.0 — 2026-05-17`
into `v190-2026-05-17`: the dots are stripped, the date is appended.
The UpdatesSheet does not know the release date, so it cannot compute
that slug from the row data. Forcing the anchor to `{ #v1-9-0 }` makes
the URL trivially derivable from the `to` version string alone.

The same convention will apply to future releases — the docs page
template gets a new entry on each release, with the anchor inlined.

## Disabled state

The link button is rendered inside a flex row that also contains the
Update button. When the row is updating (i.e. `loading === true`), the
link is replaced by the same `<button>` element with `disabled` /
`aria-disabled` — that keeps the layout stable and prevents a
context-switch click mid-update.

A simpler alternative considered: keep the link clickable. Rejected
because the user could open a new tab, switch back, and the update has
already completed (row removed). Disabling makes intent clearer.

## Plugins without `repo`

The button is omitted, the row still functions. The Update button stays
at its usual position. This avoids visual asymmetry (no empty slot) and
is rare in practice — only old or community plugins might lack the
field. No tooltip explaining the absence; we keep the UI quiet.
