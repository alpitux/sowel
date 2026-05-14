# Spec 089 — Implementation plan

> Companion to `spec.md` and `architecture.md`. Sequenced tasks, test
> plan, and PR breakdown.

## PR breakdown

Two sequential PRs on a shared feature branch
`feat/sec-089-supply-chain-and-restore`:

| PR        | Title                                                                 | Effort | What it ships                                                            |
| --------- | --------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------ |
| **089-1** | feat(sec): plugin SHA256 + community namespace + tar hardening (C1)   | ~½ day | Registry schema, checksum verify, owner badge, tar flags, symlink refuse |
| **089-2** | feat(sec): backup restore path confinement + extension whitelist (C2) | ~½ day | Path resolve+check, extension allow-list, symlink refuse, size cap       |

PRs are sequential to keep diffs scoped and reviewable in isolation.

## Task sequence — PR 089-1 (C1)

Follow this strict order so dependent steps don't break:

1. **[types]** Add `sha256` and `owner` to `RegistryEntry` in
   `src/packages/registry-types.ts`. Add `OFFICIAL_OWNERS` constant.
2. **[data]** Generate SHA256 for every current entry in
   `plugins/registry.json`. For each entry: fetch the tarball locally,
   `shasum -a 256`, embed. Add `owner` derived from `repo`.
3. **[tests, attack]** Write attack tests first (`tarball-tampered`,
   `tarball-symlink-escape`, `tarball-absolute-path`,
   `registry-missing-sha256`, `community-plugin-confirm`). Mark with
   `// SECURITY: attack must succeed on main, must fail post-fix`.
   Verify on the branch tip (still no fix) — they should pass in the
   "attack succeeds" mode.
4. **[core]** Implement SHA256 verify in `package-manager.ts:460`
   (`downloadPrebuiltAsset`). Throw `ChecksumMismatchError` on
   mismatch. Wire into existing error path so UI gets a clean message.
5. **[core]** Implement `OFFICIAL_OWNERS` check in `install()`. Throw
   `CommunityPluginConfirmationRequiredError` when owner is not
   official and `opts.confirmed !== true`.
6. **[core]** Add tar flags (`--no-absolute-names`, `--no-same-owner`,
   `--no-same-permissions`) to the `execFile("tar", …)` call (line
   ~504). Add post-extraction symlink scan as defence in depth.
7. **[types]** Add `isOfficial` to `PluginManifestPublic` in
   `src/shared/types.ts`. Compute when serializing entries to
   `GET /api/v1/plugins/available`.
8. **[api]** Update `POST /api/v1/plugins/install/:id` to accept
   `{ confirmed?: boolean }`. On
   `CommunityPluginConfirmationRequiredError`, return 409 with
   `{ error: "CommunityPluginConfirmationRequired", owner }`.
9. **[ui]** In `PluginsPage.tsx`: community badge in plugin list (small
   amber pill), confirm modal on install click for community plugins,
   handle 409 response.
10. **[ui]** i18n strings: `fr.json` + `en.json` for
    "community" badge, confirm modal title/body/buttons.
11. **[tests, regression]** Re-run attack tests — they must now assert
    the "blocked" outcome. Update marker comment to
    `// SECURITY: regression guard for spec 089 (C1)`.
12. **[docs]** Add SHA256 workflow note to
    `docs/technical/plugin-development.md`.

## Task sequence — PR 089-2 (C2)

1. **[tests, attack]** Write attack tests first
   (`restore-path-traversal`, `restore-symlink`,
   `restore-bad-extension`, `restore-zip-bomb`). Mark with
   `// SECURITY: attack must succeed on main, must fail post-fix`.
2. **[core]** Add `ALLOWED_EXTENSIONS` set and
   `MAX_UNCOMPRESSED_BYTES` constant at the top of
   `src/backup/backup-manager.ts`.
3. **[core]** Replace the vulnerable block at lines 425-438:
   - Strict `resolve` + `startsWith(dataDir + sep)` check.
   - Symlink detection on entry external attributes.
   - Extension whitelist.
   - Cumulative size cap.
   - `BackupSizeCapExceededError` exported.
4. **[core]** Add `mkdirSync(dirname(filePath), { recursive: true })`
   before `writeFileSync` (current code may already do this — verify).
5. **[tests, regression]** Re-run attack tests — they must now assert
   the "blocked" outcome. Update markers.
6. **[docs]** Add a short "restore behaviour" note to
   `docs/technical/deployment.md` (which extensions are accepted,
   what happens on malicious entries).

## Test plan

### Methodology — Attack-first TDD

For each finding, the attack test is written **first**, on the feature
branch, before the fix. It must demonstrate the vulnerability still
works on `main` (i.e. the attack succeeds). Then the fix is implemented;
the same test now asserts the attack is **blocked**.

This is the spec's core security guarantee — see spec.md §"Test plan"
for the rationale.

### Modules to test

| Module                            | Scope                                                          |
| --------------------------------- | -------------------------------------------------------------- |
| `src/packages/package-manager.ts` | C1 — SHA256 verify, owner check, tar hardening                 |
| `src/backup/backup-manager.ts`    | C2 — path confinement, extension allow-list, symlink, size cap |

### Scenarios — C1 (Plugin integrity)

| #            | Scenario                                                                | Pre-fix expectation               | Post-fix expectation                                                               |
| ------------ | ----------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------- |
| C1.1         | Install plugin where tarball byte was flipped after SHA256 was recorded | Install succeeds, plugin loaded   | `ChecksumMismatchError`, no file under `data/plugins/<id>/`                        |
| C1.2         | Registry entry without `sha256` field                                   | Install succeeds (no check)       | Entry rejected at registry load, install API returns 404 (not found)               |
| C1.3         | Tarball contains symlink `link → /etc/passwd`                           | Symlink extracted into plugin dir | Tar refuses the entry, or post-scan unlinks dir and throws `SymlinkInTarballError` |
| C1.4         | Tarball contains absolute path `/tmp/owned`                             | File created at `/tmp/owned`      | Refused by `--no-absolute-names` flag                                              |
| C1.5         | Install community plugin (owner ≠ "mchacher") without `confirmed: true` | Install succeeds silently         | API returns 409 `CommunityPluginConfirmationRequired`; UI opens confirm modal      |
| C1.6         | Install community plugin with `confirmed: true` and valid SHA256        | (same — succeeds)                 | Install proceeds normally                                                          |
| C1.7 (retro) | Install official plugin (owner = "mchacher") with valid SHA256          | Succeeds                          | Succeeds (no UI friction)                                                          |

### Scenarios — C2 (Backup restore)

| #            | Scenario                                                                          | Pre-fix expectation                | Post-fix expectation                                                     |
| ------------ | --------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------ |
| C2.1         | ZIP entry `data/../../tmp/sowel-pwned`                                            | File written to `/tmp/sowel-pwned` | Entry skipped, warning logged, no file outside `dataDir`                 |
| C2.2         | ZIP entry that is a symlink                                                       | Symlink created inside `dataDir`   | Entry skipped, warning logged                                            |
| C2.3         | ZIP entry `data/payload.so` (executable extension)                                | File written                       | Skipped, warning logged                                                  |
| C2.4         | ZIP entry `data/payload.node` (native module)                                     | File written                       | Skipped, warning logged                                                  |
| C2.5         | ZIP with cumulative uncompressed size > 1 GB                                      | Restore continues until disk fills | `BackupSizeCapExceededError` thrown atomically, partial files cleaned up |
| C2.6 (retro) | Legitimate Sowel-produced backup (only whitelisted extensions, well-formed paths) | Restore succeeds                   | Restore succeeds (no regression)                                         |

### Helper code for tests

To craft malicious tarballs/ZIPs without external binaries, use Node's
`tar-stream` or build the archive bytes manually in a test helper:

```ts
// test/helpers/build-malicious-tarball.ts
export function buildTarballWithSymlink(name: string, target: string): Buffer { … }
export function buildTarballWithAbsolutePath(absPath: string): Buffer { … }
export function buildTarballWithFlippedByte(original: Buffer, offset: number): Buffer { … }

// test/helpers/build-malicious-zip.ts
export function buildZipWithTraversalEntry(target: string): Buffer { … }
export function buildZipWithSymlinkEntry(linkName: string, target: string): Buffer { … }
export function buildZipWithFakeSize(claimedUncompressed: number): Buffer { … }
```

Existing tests in `src/backup/*.test.ts` and `src/packages/*.test.ts`
give the patterns for mocking the filesystem and asserting log calls.

## Validation — before merging each PR

```bash
# Backend type + lint + test
npx tsc --noEmit
npx eslint src/ --ext .ts
npx vitest run

# UI (PR 089-1 only — touches PluginsPage.tsx + i18n)
cd ui && npx tsc -b --noEmit && npx eslint .

# Full validate
npm run validate
```

ZERO errors required on each. Tests must include the new attack-mode
tests in the "blocked" assertion mode.

## Risks / open during implementation

- **GNU tar vs BSD tar on macOS dev**: if the new flags break local
  test runs on macOS, gate the post-extraction symlink scan to "always
  on" as the primary defence and treat the tar flags as defence in
  depth (their absence on BSD is then not blocking).
- **Existing `plugins/registry.json` SHA256 backfill**: requires
  downloading each tarball locally to compute. Manual one-off task at
  the start of PR 089-1. If a plugin tarball is no longer available
  upstream (GitHub release deleted), entry must be removed from the
  registry — verify each before computing.
- **adm-zip symlink detection**: `adm-zip` may not expose entry mode
  bits cleanly. If the helper is awkward, switch to `yauzl` or check
  `entry.attr` / external-attributes manually. Spike at the top of
  PR 089-2.

## Done = all of:

- Both PRs merged into `main`.
- All attack tests assert the "blocked" outcome on `main`.
- `npm run validate` green.
- `plugins/registry.json` has `sha256` and `owner` on every entry.
- UI shows community badge and confirmation modal for non-official
  plugins.
- `docs/technical/plugin-development.md` describes the SHA256-in-PR
  workflow.
- Spec acceptance criteria from `spec.md` "Success criteria" are all
  checked.
