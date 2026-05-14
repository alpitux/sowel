# Spec 104 — Self-update resilience

> Light spec: a defensive fix to the existing self-update flow. No new
> features, no UI changes, no schema changes.

## Problem

The current self-update helper in `src/core/update-manager.ts`:

1. Pulls `ghcr.io/mchacher/sowel:<targetVersion>`
2. Retags the pulled image locally as `:latest`
3. Runs `docker compose up -d sowel`
4. Logs "done — Sowel updated to v<targetVersion>"

This works **only** if `docker-compose.yml` says `image:
ghcr.io/mchacher/sowel:latest`. On `domopi.local` (the demo Pi), the
compose file had been changed to `image: ghcr.io/mchacher/sowel:1.6.1`
(the original was `:latest`, the `.bak` confirms it). With that pin,
`docker compose up -d` sees no diff (compose says `1.6.1`, container
runs `1.6.1`) and skips recreate. The helper then logs "done" without
checking the result, so the user sees a successful update with no
actual change.

Three weaknesses in one flow:

- **Implicit dependency** on `:latest` in compose, never enforced
- **No verification** that the running container matches the target
- **No diagnostic** when the swap silently fails

## Goal

Make the self-update flow robust regardless of the compose file's
`image:` value, and surface a clear error when something goes wrong
rather than claiming success.

## Approach

Three changes to the helper command in `update-manager.ts:spawnHelper()`:

1. **Normalize the compose file**: before `docker compose up -d`, sed
   the sowel service's `image:` line to point at `:latest`. Idempotent
   (no-op if already `:latest`). Backup the original to
   `docker-compose.yml.bak` only the first time (don't overwrite an
   existing `.bak`).

2. **Force recreate**: use `docker compose up -d --force-recreate
sowel` so the container always swaps to the new locally-tagged
   `:latest` regardless of compose-level diff detection.

3. **Verify post-update**: after recreate, inspect the running
   container's image ID. If it doesn't match the target image's ID
   (resolved via `docker image inspect ghcr.io/mchacher/sowel:<target>
--format {{.Id}}`), log a clear `FAILED` line and exit non-zero so
   the user can see the failure in the helper logs.

The compose backup pattern (`.bak` if not present) lets the user
rollback manually if needed. The sed is a single, simple, anchored
expression — limited blast radius.

## Out of scope

- Doc updates beyond a brief mention in deployment.md (not required —
  the change is transparent to operators)
- Spec-level testing of every compose edge case (multi-line image
  declarations, comments inside image line, etc.) — the sed targets
  the single canonical line `image: ghcr.io/mchacher/sowel:<anything>`
- Replacing compose entirely — out of scope, would be a much larger
  redesign

## Acceptance criteria

- [x] Helper script normalizes `image:` line to `:latest` before recreate
- [x] Helper uses `--force-recreate` on `docker compose up -d`
- [x] Helper verifies the post-recreate container image ID matches the
      pulled target and logs `FAILED` + exits non-zero on mismatch
- [x] Existing tests for `update-manager` still pass
- [x] New unit tests cover the normalization sed (with input/output
      fixtures) and the verify step (mocked docker image inspect)

## Test plan

| Module         | Scenario                                     | Expected                                                           |
| -------------- | -------------------------------------------- | ------------------------------------------------------------------ |
| update-manager | Compose already `:latest`                    | Sed is a no-op, no `.bak` overwrite                                |
| update-manager | Compose pinned to `:1.6.1`                   | Sed rewrites to `:latest`, `.bak` saved on first run               |
| update-manager | Compose has unrelated lines                  | Only the sowel `image:` line touches; other services unchanged     |
| update-manager | Post-recreate image ID matches target        | Helper logs `done` (verified) and exits 0                          |
| update-manager | Post-recreate image ID does NOT match target | Helper logs `FAILED — running image <X>, expected <Y>` and exits 1 |

## Manual rollout

After this ships in vX.Y.Z (next release):

1. Existing Sowel instances stuck on an old version because of the
   compose-pin issue: **one manual update via SSH** (sed + restart),
   same as the fix we just did on `domopi.local`. After that single
   manual fix to vX.Y.Z, future self-updates will work.
2. New installs from `scripts/install.sh` already use `:latest`, so
   they are unaffected.

## Effort

~½ day. Self-contained in `src/core/update-manager.ts` + new tests.
