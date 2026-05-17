# Spec 108 — Architecture

CI guardrail only. No backend, no UI, no database, no event bus, no API.

## Files touched

| File                            | Change                                                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/release.yml` | New `verify-release-notes` job; `ci`, `build` (and any other downstream job) gain `needs: verify-release-notes` |
| `CLAUDE.md`                     | New "Release notes are mandatory" section after spec 089                                                        |

The reusable `release.sh` script is **not** modified. Per the discussion summarised in `spec.md` § "Why CI-only", duplicating the grep there gains no safety while doubling the maintenance surface.

## Workflow job placement

```yaml
jobs:
  verify-release-notes:
    if: github.event_name == 'push' # tag pushes only
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check release-notes entry for ${{ github.ref_name }}
        run: |
          VERSION="${GITHUB_REF#refs/tags/v}"
          ANCHOR="v$(echo "$VERSION" | tr . -)"
          missing=0
          for f in docs/release-notes.md docs/release-notes.fr.md; do
            if ! grep -qF "{ #${ANCHOR} }" "$f"; then
              echo "::error file=$f::Missing release-notes entry for v$VERSION (expected anchor: { #${ANCHOR} })"
              missing=1
            fi
          done
          if [ "$missing" = "1" ]; then
            echo "Add a '### v$VERSION — YYYY-MM-DD { #${ANCHOR} }' block under the matching minor section in both EN and FR files, then re-tag (git tag -f vX.Y.Z && git push --force origin vX.Y.Z)."
            exit 1
          fi

  ci:
    if: github.event_name != 'workflow_dispatch' || inputs.restore_latest_from == ''
    needs: verify-release-notes
    # … existing steps unchanged …

  build:
    needs: [ci, verify-release-notes]
    # … existing steps unchanged …
```

The `if:` on `verify-release-notes` skips it for the manual
`restore_latest_from` workflow_dispatch path — that flow does not
publish a new version, it only repoints `:latest`, so no docs entry is
required.

## Edge cases

- **Manual `workflow_dispatch` with `restore_latest_from`** — skipped
  by the `if:` clause, as above.
- **Test tag pushed (e.g. `v9.99.0-test`)** — the regex matches `v*`,
  so the workflow fires. The check will fail (no docs entry for a test
  tag), which is the desired behaviour: test tags are not real
  releases. To skip the check for a deliberate test tag, push the tag
  without the `v` prefix, or use `workflow_dispatch` with `test_tag`
  instead (that input already exists in the workflow).
- **Pre-release tags like `v1.10.0-rc.1`** — `tr . -` produces
  `v1-10-0-rc-1`, which the check looks for. If we want pre-releases to
  be exempt, add `if [[ "$VERSION" == *-* ]]; then exit 0; fi` before
  the loop. Not needed today (no pre-release tags in history) but
  documented here as a known toggle.
- **Two consecutive releases on the same day** — irrelevant, the anchor
  format includes only the version, not the date.

## Why both files

Both `docs/release-notes.md` (EN, default locale) and
`docs/release-notes.fr.md` are required. The MkDocs i18n plugin builds
each locale independently — a French-speaking user clicking the
changelog link from a French UI lands on `/fr/release-notes/#vX-Y-Z`,
which only exists if `release-notes.fr.md` carries the anchor. Failing
the CI on either file is intentional.

## Recovery

When CI fails on a freshly pushed tag:

```bash
# 1. Add the EN + FR entries to docs/release-notes.{md,fr.md}
git add docs/release-notes.md docs/release-notes.fr.md
git commit --amend --no-edit          # fold into the release commit
git push --force-with-lease            # update main
git tag -f vX.Y.Z                      # repoint local tag at the new commit
git push --force origin vX.Y.Z         # repoint remote tag → CI re-runs
```

`--force-with-lease` is safer than `--force` for `git push` on `main`;
on the tag itself, plain `--force` is fine because tags do not have
the same "someone may have pushed in between" semantics as branches.

## Why CLAUDE.md too

CI catches the mistake. CLAUDE.md prevents it from being made in the
first place by Claude or any future contributor reading the project
guide. The two surfaces are complementary, not redundant: CI is the
enforced contract, CLAUDE.md is the documented expectation that helps
agents and humans align with the contract.
