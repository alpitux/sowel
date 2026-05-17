# Spec 108 — Implementation plan

CI guardrail. One YAML job, one CLAUDE.md section, one memory tweak. Single branch `feat/verify-release-notes`.

## Tasks

1. [ ] Read `.github/workflows/release.yml` to confirm the existing `ci`, `build`, `release` job graph
2. [ ] Add a `verify-release-notes` job at the top of the workflow with the grep check (see `architecture.md`)
3. [ ] Add `needs: verify-release-notes` to every downstream job (`ci`, `build`, anything that gates the published release). The `restore-latest` job stays untouched (manual dispatch path, no version change)
4. [ ] Add the "Release notes are mandatory (spec 108 — MANDATORY for AI agents)" section to `CLAUDE.md`, right after the existing spec 089 section
5. [ ] Update `~/.claude/projects/.../memory/feedback_release_notes_required.md` so the wording reflects "spec 108 is the enforced contract" (already drafted; verify it does not still say "spec 108 will enforce" in future tense)
6. [ ] Sanity-check the YAML locally with `yq` or `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml'))"`
7. [ ] Verify the grep against an existing release (`v1.9.0`): manually run the same script with `VERSION=1.9.0` and confirm exit 0
8. [ ] Verify the grep against a fake version (`v99.99.99`): same script, confirm exit 1 with the error message
9. [ ] Commit on `feat/verify-release-notes`, push, open PR
10. [ ] Real validation happens at the next release: the check must pass for `vX.Y.Z` when the docs entries exist

## Test plan

The check itself is a single grep against two files — no business logic to unit-test (CLAUDE.md: "What NOT to test: simple CRUD wrappers, direct DB queries"). The deterministic verification matrix from `spec.md` § Test plan is the manual checklist driving steps 7 and 8.

| Local dry-run                                           | Expected                                                   |
| ------------------------------------------------------- | ---------------------------------------------------------- |
| `VERSION=1.9.0` (anchor `{ #v1-9-0 }` present)          | Exit 0, no error                                           |
| `VERSION=99.99.99` (no anchor anywhere)                 | Exit 1, two `::error file=…` lines (EN + FR), helpful hint |
| `VERSION=1.9.0` with FR file temporarily missing anchor | Exit 1, one `::error file=docs/release-notes.fr.md` line   |

The real CI proof is observed in the next release: either it succeeds (because the docs are kept in sync, as required by CLAUDE.md and memory), or it fails fast and the recovery flow from `architecture.md` is exercised once.

No backend tests touched. No UI tests touched.
