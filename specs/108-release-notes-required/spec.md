# Spec 108 — Block releases without release notes

> Light spec: a single CI guardrail. One job in one workflow. No
> backend, no UI, no local hook.

## Problem

Spec 107 made every UpdatesSheet row link to a versioned anchor on
`docs.sowel.org/release-notes/#v<x>-<y>-<z>`. If the docs page does
not have an entry for the new version, that link silently lands on
the top of the page — the user thinks "nothing changed".

Today there is nothing stopping anyone — including future-me — from
running `scripts/release.sh 1.10.0` (or pushing a tag by hand) without
first adding the matching entry to `docs/release-notes.md` and
`docs/release-notes.fr.md`. The release ships, the changelog is
missing, the in-app link breaks.

## Goal

Make it impossible to publish a Sowel release whose tagged commit
lacks a corresponding release-notes entry. Failure must be loud and
happen _before_ any image is built or release artifact is created.

## Approach

A single grep-based gate, in CI.

The `Release` workflow runs on `push: tags: ["v*"]`. Add a job
`verify-release-notes` that the existing `ci`, `build`, and `release`
jobs all depend on (`needs: verify-release-notes`). The job:

1. Checks out the tag.
2. Extracts the version from `${GITHUB_REF#refs/tags/v}`.
3. Greps both `docs/release-notes.md` and `docs/release-notes.fr.md`
   for `{ #v<x>-<y>-<z> }`.
4. Exits non-zero with a clear message on miss.

```bash
ANCHOR="v$(echo "$VERSION" | tr . -)"
for f in docs/release-notes.md docs/release-notes.fr.md; do
  if ! grep -qF "{ #${ANCHOR} }" "$f"; then
    echo "::error file=$f::Missing release-notes entry for v$VERSION (expected anchor: { #${ANCHOR} })"
    echo "Add a '### v$VERSION — YYYY-MM-DD { #${ANCHOR} }' block under the matching minor section in both EN and FR files, then re-tag."
    exit 1
  fi
done
```

Because the other jobs `needs:` this one, the failure fires before
the Docker layers, before the GitHub release, before `:latest` is
repointed. The tag itself stays on the remote but the release is not
published.

### Recovery when the check fails

```bash
# 1. Add the entries to docs/release-notes.{md,fr.md}
# 2. Amend the release commit (or add a fixup commit)
git commit --amend --no-edit  # or: git commit -m "docs: add release notes for vX.Y.Z"
git push                        # update main
git tag -f vX.Y.Z              # repoint local tag at the new commit
git push --force origin vX.Y.Z # repoint remote tag → CI re-runs
```

Two commands beyond the docs edit. No dangling Docker images, no
broken in-app links, no published release lacking notes.

### Why CI-only

A pre-commit hook or check in `scripts/release.sh` would catch the
mistake earlier locally, but:

- It does not cover manual `git tag` paths, `workflow_dispatch`, or
  cases where someone edits `release.sh` to skip the check.
- It would duplicate logic — the CI gate is still needed as the
  authoritative contract, so the script check becomes redundant.
- The recovery from a CI miss is two commands (`git tag -f` +
  `git push --force origin <tag>`), not a five-step ordeal.

One gate, one source of truth, every path covered.

## Out of scope

- Auto-generating release notes from commit messages. The page is a
  curated user-facing summary (see spec 107 / docs.sowel.org/release-notes),
  not a raw conventional-commits dump. We keep the human editorial layer.
- A pre-commit hook on the version bump. Releases happen through
  `scripts/release.sh`, not arbitrary commits, so the check belongs
  there.
- A backfill for the 61 existing versions. They already have entries
  thanks to spec 107.

## Acceptance criteria

- [ ] `.github/workflows/release.yml` has a `verify-release-notes` job
      that runs first and is in the `needs:` list of `ci`, `build` and
      `release`.
- [ ] Pushing a `v*` tag whose commit lacks the EN or FR docs entry
      fails CI with the actionable error, _before_ any Docker layer is
      built or the GitHub release is created. (Verified by an
      intentional dry-run test tag on a feature branch.)
- [ ] Pushing a `v*` tag whose commit has both entries succeeds as
      today.
- [ ] The memory entry `feedback_release_notes_required.md` is updated
      to point at this spec as the enforced contract.
- [ ] `CLAUDE.md` documents the requirement under a "Release notes are
      mandatory (spec 108 — MANDATORY for AI agents)" section, mirroring
      the structure of the existing "Plugin supply chain security
      (spec 089 — MANDATORY for AI agents)" section.

## Test plan

| Scenario                                                     | Expected                                                                               |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| CI `verify-release-notes` against `v1.9.0` (already shipped) | Job succeeds — `{ #v1-9-0 }` present in both files                                     |
| CI `verify-release-notes` against `v1.99.0` (no entry)       | Job fails with a `::error` line naming both missing files; downstream jobs are skipped |
| CI `verify-release-notes` against tag with anchor only in EN | Job fails naming `docs/release-notes.fr.md`                                            |
| Test tag pushed to a feature branch (no entries)             | Workflow fails fast in the verify job; `ci`/`build`/`release` never run                |

Backend unit tests are untouched. No UI changes.

## Files touched

```
.github/workflows/release.yml      (new verify-release-notes job + needs:)
specs/108-release-notes-required/  (spec + plan + arch)
```

## Effort

~15 min. One YAML job. No script changes, no backend, no UI, no DB.
