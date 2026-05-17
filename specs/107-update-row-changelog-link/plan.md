# Spec 107 — Implementation plan

UI + docs anchors, single branch `feat/updates-changelog-link`.

## Tasks

1. [x] Add explicit `{ #v<x>-<y>-<z> }` anchors to every `### v<x>.<y>.<z> — <date>` heading in `docs/release-notes.md` and `docs/release-notes.fr.md`
2. [x] Verify on a local `mkdocs build --strict` that anchors resolve (sample check: open `#v1-9-0` and `#v1-0-0` in the built HTML)
3. [x] Edit `ui/src/components/layout/UpdatesSheet.tsx`:
   - Add a `changelogUrl(kind, repo, to)` pure helper returning the URL or `null`
   - In `UpdateRow`, render an `<a>` (when active) or `<button>` (when row is updating) before the Update button, with `FileText` icon, tint `text-text-tertiary`
   - The `a`/`button` uses `target="_blank" rel="noopener noreferrer"` when it is an anchor
   - Omit the element entirely when `changelogUrl()` returns `null`
4. [x] Add i18n keys `updates.action.viewChangelog` to `ui/src/i18n/locales/fr.json` and `en.json` with `{{from}}`/`{{to}}` interpolation
5. [x] `npx tsc --noEmit` + `cd ui && npx tsc -b --noEmit`
6. [x] `npx eslint src/ --ext .ts && cd ui && npx eslint .`
7. [x] `npx vitest run` — no backend changes, suite must stay green
8. [x] `mkdocs build --strict` — anchors valid, no new warnings
9. [ ] Visual check on local dev or demo: link opens the right docs anchor for core, the right GitHub release page for plugins _(pending — local pill only renders when an update is available; verify on prod/demo after deploy)_

## Test plan

Pure UI / docs work, no business logic to unit-test (CLAUDE.md: "What NOT to test: UI components"). The verification matrix from `spec.md` § Test plan is the manual checklist driving step 9.

Two parts are deterministic enough to spot-check via grep + a fresh `mkdocs build` (step 2 + step 8 above):

- Every `### v<x>.<y>.<z>` heading carries a matching `{ #v<x>-<y>-<z> }` attribute in both EN and FR files.
- The built site (`site/release-notes/index.html`) has `id="v1-9-0"` (and friends) on the corresponding `<h3>`.

Backend unit tests untouched.
