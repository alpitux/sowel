# Spec 089 — Security hardening: plugin supply chain & backup path safety

> Driven by the cybersecurity audit of 2026-05-03 (`SECURITY_AUDIT.md`).
> This spec covers the two **P1 (critical) RCE findings** — C1 and C2.
> C3 (backup secrets leak) is **explicitly deferred** to a later spec (see
> "Out of scope" below). Higher-effort items (P2 runtime hardening, P3
> data-at-rest encryption) are addressed in their own follow-up specs.

## Goal

Close the two RCE vulnerabilities identified as critical in the audit:

- **C1 — Plugin supply chain**: Sowel currently downloads plugin tarballs
  from GitHub releases and `import()`s them with no integrity check. A
  compromised maintainer account, a MITM, or a hostile registry entry
  yields RCE on the host.
- **C2 — Backup restore path traversal**: `restoreBackup` extracts archive
  entries with `path.resolve(dataDir, filename)` after a bypassable
  `startsWith("data/")` check. A crafted ZIP can write anywhere on disk,
  yielding RCE by authenticated admin.

After this spec ships, an attacker without write access to either the
plugin registry or an authenticated admin session cannot trigger code
execution through these two paths.

## Why this iteration matters

Sowel runs `sowel-plugin-*` packages downloaded from GitHub at runtime
and exposes a public WAN endpoint (`app.sowel.org`). Every plugin install
and every backup upload is, today, a code-execution opportunity for an
attacker. The audit flagged these two as the dominant RCE risks. Before
adding more plugins or growing the public footprint, we need a baseline
of integrity on these two flows.

C3 (backup secrets exported in cleartext) is a real concern but
materially lower priority: it is a **confidentiality leak** that requires
the attacker to first obtain the backup file (lost USB, shared cloud
folder, mis-sent email). It is not a remote code execution path. We
accept this risk for now and revisit it when a concrete external-sharing
scenario emerges. See "Out of scope".

## Key design decisions

### C1 — Plugin integrity (checksum + community namespace)

- **Checksum, not signature** for this iteration. Threat model covered:
  MITM, CDN tampering, hostile registry entry pointing to a foreign repo.
  Threat model **not** covered: full takeover of a legitimate plugin
  maintainer's GitHub account — that requires GPG/cosign and comes in a
  later spec when the third-party ecosystem grows.
- The **expected SHA256** lives in `plugins/registry.json` per entry,
  alongside `repo`, `owner`, and `version`. The registry is fetched from
  the remote URL on boot; if remote is unreachable, the bundled local
  copy is used. The registry itself is served over HTTPS and pinned to
  the Sowel repo on GitHub.
- **Official vs community plugins** (instead of a strict whitelist):
  - Each registry entry carries an `owner` field. Plugins whose owner is
    the Sowel author (initially `mchacher`) are flagged **official** and
    install with no extra UI friction.
  - Plugins from any other owner are flagged **community**. They install
    only after an **explicit confirmation dialog** in the UI ("This
    plugin is published by a third party. Sowel verifies its integrity
    via SHA256 but does not vouch for its code. Continue?"). UI lists
    show a clear "community" badge.
  - This keeps the ecosystem open to contributions while making the
    trust boundary visible to the user. SHA256 checksum verification is
    **mandatory for both** categories.
- **Verification flow**:
  1. Fetch tarball from `browser_download_url`.
  2. Compute SHA256 of the downloaded file.
  3. Compare against `registry.json` entry.
  4. If mismatch, delete the tarball and refuse install with a structured
     log + UI error.
  5. If match, proceed to `tar -xzf` extraction.
- **Tar extraction hardening**: add `--no-absolute-names`,
  `--no-same-owner`, and `--no-same-permissions` to the existing
  `execFile("tar", …)` call so a malicious archive cannot escape the
  extract dir or set unexpected ownership.
- **Symlink refusal**: tar must reject entries that are symlinks
  (preferred via flag, or via a post-extraction scan if no flag works
  uniformly).
- **Plugin author workflow**: the `npm run release` script in the plugin
  template computes the SHA256 of the produced tarball and prints it.
  The plugin author opens a PR against the Sowel `registry.json` with
  the new version, hash, and `owner`. Manual review is the security
  gate.

### C2 — Backup restore path confinement

- Replace the current `startsWith("data/")` check with a strict
  `path.resolve` + `startsWith(dataDir + sep)` check. Reject the entry
  with a warning if it escapes.
- Refuse symlinks inside the archive (entry type check).
- Add a **whitelist of allowed extensions** under `data/` (e.g. `.json`,
  `.png`, `.jpg`, `.svg`, `.db`, `.db-shm`, `.db-wal`, `.jwt-secret`,
  `.influx-token`, `.log`). Reject anything else with a warning,
  including `.sh`, `.so`, `.node`, executables, etc.
- Limit the total uncompressed size of `data/*` entries to a configurable
  cap (default 1 GB) — defence in depth against zip bombs.

## Out of scope of this iteration

- **C3 — Backup encryption / secrets exclusion**: backups continue to be
  stored as unencrypted ZIPs with cleartext settings. Rationale:
  - The threat is a confidentiality leak, not RCE.
  - It only materialises if the backup file leaves the host
    (mis-shared, lost USB, etc.).
  - Mitigation has a meaningful UX cost (passphrase management) that
    does not buy proportional value for a single self-hosted instance
    today.
  - We will revisit when a public-sharing / multi-tenant scenario
    appears, or if the audit re-prioritises.
- GPG/cosign signature of plugins — will revisit when the plugin
  ecosystem includes third-party maintainers and trust beyond SHA256 is
  warranted.
- At-rest encryption of secrets in the live SQLite database (P3 in the
  audit — its own spec, heavier change due to key management on a
  long-running engine).
- Container-level hardening (`USER 1000`, removing `docker.sock` from
  default compose) — P2, separate spec.
- Helmet / CSP / CORS defaults — P2, separate spec.
- Auto-update image digest pinning — P2, separate spec.
- Registry-staleness UI warning when the bundled fallback is used —
  considered but the user can already see the version list in
  `registry.json`; not worth additional UI in this iteration.

## Implementation plan (rough)

| Step                                                                                                                              | Files touched                                             | Effort |
| --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------ |
| Add `sha256` + `owner` fields to `registry.json` schema and entries                                                               | `plugins/registry.json`, `src/packages/registry-types.ts` | XS     |
| Compute & verify SHA256 in `downloadPrebuiltAsset`                                                                                | `src/packages/package-manager.ts:460`                     | S      |
| Surface `owner` + `isOfficial` in plugin manifest exposed to UI                                                                   | `src/packages/package-manager.ts`, `src/shared/types.ts`  | XS     |
| Harden `tar` flags + refuse symlinks                                                                                              | `src/packages/package-manager.ts:504`                     | XS     |
| Confine restore + extension whitelist + size cap + symlink refusal                                                                | `src/backup/backup-manager.ts:425-438`                    | S      |
| UI: community badge + explicit confirm dialog on community install                                                                | `ui/src/pages/PluginsPage.tsx` (or equivalent)            | S      |
| Tests: malicious tarball (checksum mismatch, symlink, absolute path), malicious ZIP (traversal, symlink, bad extension, zip bomb) | new files under `src/**/__tests__`                        | S      |
| Doc update: plugin author guide (SHA256 in PR), restore behaviour notes                                                           | `docs/`                                                   | XS     |

Total estimated effort: **1 to 1.5 days of focused work**.

## Risks / open questions

- **Owner whitelist evolution**: when the first community plugin appears,
  the "official vs community" UI distinction needs to be tested with a
  real third-party entry. The current decision (open install with
  warning) is a deliberate trade-off between ecosystem growth and
  control.
- **Tarball SHA256 source of truth**: registry (canonical) vs. plugin's
  own `manifest.json` inside the tarball. Registry remains canonical —
  manifest hash would be self-attesting and useless. Confirmed.
- **`tar` flag portability**: `--no-absolute-names`, `--no-same-owner`,
  `--no-same-permissions` exist in GNU tar (Linux containers). BSD tar
  on macOS dev machines differs but production runs in Docker on Linux
  — to confirm we don't accidentally break local `npm test` on macOS.

## Test plan — TDD with attacker tests first

### Methodology

We invert the usual TDD order: for each finding, we **first write the
attack test** that proves the vulnerability exists on `main`, then
implement the fix until the same test asserts the attack is **blocked**.

This guarantees:

- the test exercises the real attack surface (not a sanitised proxy);
- we cannot ship a fix that "looks right" but misses the attack vector;
- the test stays in the suite as a permanent regression guard.

Workflow per finding:

1. Write the attack test on `main` — it must demonstrate the
   vulnerability (write outside `dataDir`, install a tampered plugin,
   etc.). Commit on the branch with a `test:` prefix and a marker
   comment `// SECURITY: attack must succeed on main, must fail post-fix`.
2. Implement the fix on the same branch.
3. Re-run the test — it must now assert the **blocked** outcome.
4. Update the marker comment to `// SECURITY: regression guard for spec 089`.

### C1 — Plugin integrity attack tests

| Test                                                                             | Expected before fix             | Expected after fix                                                                                        |
| -------------------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `tarball-tampered.test.ts` — fetch tarball, flip one byte, attempt install       | Install succeeds, plugin loaded | Install rejected with `ChecksumMismatchError`, no file under `data/plugins/`                              |
| `tarball-symlink-escape.test.ts` — tarball contains symlink `link → /etc/passwd` | Symlink extracted to plugin dir | Tar flags / post-extraction scan reject the symlink, install fails                                        |
| `tarball-absolute-path.test.ts` — tarball contains absolute path `/tmp/owned`    | File written to `/tmp/owned`    | Refused by `--no-absolute-names`, install fails                                                           |
| `registry-missing-sha256.test.ts` — registry entry without `sha256` field        | Install proceeds (no check)     | Install rejected with `RegistryEntryInvalidError`                                                         |
| `community-plugin-confirm.test.ts` — install plugin where `owner !== "mchacher"` | Install proceeds silently       | UI surfaces explicit confirm dialog before download; programmatic install requires `confirmed: true` flag |

### C2 — Backup restore attack tests

| Test                                                                      | Expected before fix                | Expected after fix                                       |
| ------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------- |
| `restore-path-traversal.test.ts` — ZIP entry `data/../../tmp/sowel-pwned` | File written to `/tmp/sowel-pwned` | Entry skipped, warning logged, no file outside `dataDir` |
| `restore-symlink.test.ts` — ZIP entry is a symlink                        | Symlink created inside `dataDir`   | Refused before extraction                                |
| `restore-bad-extension.test.ts` — ZIP entry `data/payload.so`             | File written                       | Skipped, warning logged                                  |
| `restore-zip-bomb.test.ts` — ZIP with 10 GB compressed claim, hits cap    | Disk filled until OOM/quota        | Restore aborted at cap, partial files cleaned up         |

### Manual / red-team checks (not in CI)

- Stand up a fake GitHub release server, point the registry at it, ship
  a tampered tarball — confirm UI surfaces a clear error, no partial
  install state remains.
- Add a fake `community` entry to a local registry copy, confirm the UI
  badge appears and the confirm dialog blocks installation until
  explicitly accepted.
- Test backup restore from a hand-crafted ZIP containing `data/../etc/`
  in a sandboxed environment.

### Coverage gate

`npm run validate` must include these tests. CI fails if any attack test
produces the "before fix" outcome — that means a regression has
re-opened a P1 vulnerability.

## Success criteria

- A plugin install with a tampered tarball is rejected with a clear
  error message, both via API and UI.
- A registry entry missing the `sha256` field is rejected, not silently
  installed.
- A community plugin (owner ≠ official) cannot be installed without an
  explicit UI confirmation; the listing shows a community badge.
- A tarball containing a symlink or an absolute-path entry is rejected
  by the extraction step.
- Restore of a ZIP containing `data/../../etc/foo` is rejected and
  logged; no file is written outside `dataDir`.
- Restore of a ZIP containing `data/x.so` (or any non-whitelisted
  extension) is rejected.
- Restore of a ZIP claiming > 1 GB uncompressed is aborted before disk
  fills.
- All behaviours above are covered by automated tests **written first
  as attack tests on `main`** (see Test plan above).
- `npm run validate` passes.
