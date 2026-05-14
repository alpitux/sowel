# Spec 089 — Architecture

> Companion to `spec.md`. Covers data model changes, file-level
> modifications, and validation flows for C1 (plugin integrity) and C2
> (backup restore confinement).

## C1 — Plugin integrity & community namespace

### Data model — `plugins/registry.json`

Each entry gains two new fields. Schema before:

```json
{
  "id": "sowel-plugin-zigbee2mqtt",
  "kind": "integration",
  "repo": "mchacher/sowel-plugin-zigbee2mqtt",
  "version": "1.2.0",
  "description": "..."
}
```

Schema after (new fields **bold** in comments):

```json
{
  "id": "sowel-plugin-zigbee2mqtt",
  "kind": "integration",
  "repo": "mchacher/sowel-plugin-zigbee2mqtt",
  "owner": "mchacher", // NEW — drives official vs community
  "version": "1.2.0",
  "sha256": "a3f9...e21c", // NEW — 64 hex chars, asset checksum
  "description": "..."
}
```

Rules:

- `sha256` is mandatory for all entries after migration. An entry without
  `sha256` is rejected at registry load (logs a structured warning,
  entry skipped).
- `owner` is mandatory. If missing, derived from `repo` (split on `/`).
- The official author list is hard-coded in code (not in registry, to
  prevent self-promotion via PR):

```ts
// src/packages/registry-types.ts
export const OFFICIAL_OWNERS = ["mchacher"] as const;
```

An entry's owner is treated as "official" when present in this list.

### Type changes — `src/packages/registry-types.ts`

```ts
export interface RegistryEntry {
  id: string;
  kind: "integration" | "recipe";
  repo: string;
  owner: string; // NEW
  version: string;
  sha256: string; // NEW (64 hex chars)
  description?: string;
}

export interface PluginManifestPublic {
  // existing fields...
  isOfficial: boolean; // NEW — derived from OFFICIAL_OWNERS check
}
```

`PluginManifestPublic` is what `GET /api/v1/plugins/available` returns
to the UI. The new `isOfficial` flag drives the UI badge.

### Verification flow — `src/packages/package-manager.ts`

The current `downloadPrebuiltAsset` (around line 460) is augmented:

```
fetch(asset.browser_download_url)
  → write to tmp file
  → compute SHA256 via crypto.createHash('sha256').update(buffer).digest('hex')
  → compare against registryEntry.sha256
  → match? proceed to extract
  → mismatch? unlink tmp file, throw ChecksumMismatchError
```

Errors surface through the existing error path so UI gets a clean
message. New error class:

```ts
export class ChecksumMismatchError extends Error {
  constructor(
    public readonly pluginId: string,
    public readonly expected: string,
    public readonly actual: string,
  ) {
    super(
      `Plugin ${pluginId}: SHA256 mismatch (expected ${expected.slice(0, 8)}…, got ${actual.slice(0, 8)}…)`,
    );
    this.name = "ChecksumMismatchError";
  }
}
```

### Tar extraction hardening — `src/packages/package-manager.ts:504`

Current call (simplified):

```ts
execFile("tar", ["-xzf", tarball, "-C", extractDir]);
```

After:

```ts
execFile("tar", [
  "-xzf",
  tarball,
  "-C",
  extractDir,
  "--no-absolute-names",
  "--no-same-owner",
  "--no-same-permissions",
  // Anchor symlink refusal — if --no-absolute-names doesn't reject
  // relative symlinks, add a post-extraction scan (see below).
]);
```

Post-extraction symlink scan (defence in depth, since GNU tar's behaviour
on relative symlinks isn't a hard refusal):

```ts
// After extract, walk extractDir; if any entry's lstat reports a symlink,
// unlink the whole directory and throw SymlinkInTarballError.
```

### Community plugin confirmation flow

The install path needs to know if the user has explicitly confirmed a
community install. Two layers:

**API**: `POST /api/v1/plugins/install/:id` accepts `{ confirmed?: boolean }`.

```ts
async function install(id, opts) {
  const entry = await getEntry(id);
  const isOfficial = OFFICIAL_OWNERS.includes(entry.owner);
  if (!isOfficial && !opts.confirmed) {
    throw new CommunityPluginConfirmationRequiredError(id);
  }
  // …proceed to download + checksum + extract
}
```

**UI** ([PluginsPage.tsx]): on install click for a community plugin, open
a confirmation modal first:

```
[!] Plugin community

Ce plugin est publié par un tiers (owner: <owner>).
Sowel vérifie son intégrité via SHA256 mais ne garantit
pas son code.

[Annuler]              [Installer quand même]
```

On confirm, retry `install` with `{ confirmed: true }`.

Visual badge in the plugin list:

```
- Official plugins: no badge (default visual)
- Community plugins: small "Community" pill (amber/warning tone)
```

### Plugin author workflow (docs only)

The plugin template's `npm run release` script will print:

```
> Release built: dist/sowel-plugin-X-1.2.0.tgz
> SHA256: a3f9...e21c
>
> Next step: open a PR against mchacher/sowel
>   - Add this version to plugins/registry.json
>   - Include sha256 above
>   - Set owner to your GitHub username
```

Out of scope: actually changing the plugin template `package.json` — that
lives in its own repo. We just document the requirement in
`docs/technical/plugin-development.md`.

## C2 — Backup restore confinement

### Current vulnerable code — `src/backup/backup-manager.ts:425-438`

```ts
if (!entry.entryName.startsWith("data/") || entry.isDirectory) continue;
const filename = entry.entryName.slice("data/".length);
const filePath = resolve(this.dataDir, filename);
writeFileSync(filePath, entry.getData());
```

Three vulnerabilities:

1. `startsWith("data/")` is bypassable by `data/../../etc/passwd`.
2. `resolve(this.dataDir, filename)` then writes wherever resolve points.
3. No symlink check, no extension check, no size cap.

### Hardened restore flow

```ts
const ALLOWED_EXTENSIONS = new Set([
  ".json",
  ".png",
  ".jpg",
  ".jpeg",
  ".svg",
  ".webp",
  ".db",
  ".db-shm",
  ".db-wal",
  ".jwt-secret",
  ".influx-token",
  ".log",
  ".txt",
]);
const MAX_UNCOMPRESSED_BYTES = 1024 * 1024 * 1024; // 1 GB
const dataDirAbs = resolve(this.dataDir);
let totalBytes = 0;

for (const entry of zip.getEntries()) {
  if (entry.isDirectory) continue;
  if (!entry.entryName.startsWith("data/")) continue;

  // 1. Symlink check — adm-zip doesn't expose symlink type directly,
  //    so we check the entry's external attributes (Unix mode bits).
  if (isSymlinkEntry(entry)) {
    logger.warn({ entry: entry.entryName }, "Backup restore: symlink entry refused");
    continue;
  }

  // 2. Path confinement
  const filename = entry.entryName.slice("data/".length);
  const filePath = resolve(this.dataDir, filename);
  if (!filePath.startsWith(dataDirAbs + sep) && filePath !== dataDirAbs) {
    logger.warn({ entry: entry.entryName }, "Backup restore: path traversal refused");
    continue;
  }

  // 3. Extension whitelist
  const ext = extname(entry.entryName).toLowerCase();
  if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
    logger.warn({ entry: entry.entryName, ext }, "Backup restore: extension not allowed");
    continue;
  }

  // 4. Cumulative size cap
  const data = entry.getData();
  totalBytes += data.length;
  if (totalBytes > MAX_UNCOMPRESSED_BYTES) {
    throw new BackupSizeCapExceededError(totalBytes);
  }

  // 5. Safe to write
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, data);
}
```

### New error classes

```ts
// src/backup/backup-manager.ts (or src/backup/errors.ts if extracted)
export class BackupSizeCapExceededError extends Error {
  constructor(public readonly bytes: number) {
    super(`Backup payload exceeds size cap (got ${bytes} bytes, cap ${MAX_UNCOMPRESSED_BYTES})`);
    this.name = "BackupSizeCapExceededError";
  }
}
```

Path-traversal, symlink, and bad-extension entries are silently skipped
with `logger.warn` rather than failing the whole restore — these are
"malicious entries", we drop them and proceed with the legitimate
remainder. Size cap is fatal because by definition we cannot continue
without filling disk.

## Event flow

No new event bus events. The existing `plugin.installed` /
`plugin.install.failed` events carry the new errors transparently.

## API surface

No new routes. `POST /api/v1/plugins/install/:id` accepts an optional
`confirmed` body field. Response body unchanged on success; on
`CommunityPluginConfirmationRequiredError` it returns 409 with a
machine-readable error code so the UI knows to prompt:

```json
{
  "error": "CommunityPluginConfirmationRequired",
  "owner": "third-party-author",
  "message": "..."
}
```

UI catches the 409 with this error code and opens the confirm dialog.

## Files touched (summary)

```
Backend:
- src/packages/registry-types.ts       (types + OFFICIAL_OWNERS constant)
- src/packages/package-manager.ts      (sha256 verify, tar flags, community check)
- src/packages/__tests__/               (new attack tests for C1)
- src/backup/backup-manager.ts          (path confine + extension + size cap)
- src/backup/__tests__/                 (new attack tests for C2)
- src/api/routes/plugins.ts            (accept `confirmed` field, return 409 code)
- src/shared/types.ts                  (PluginManifestPublic.isOfficial)

Frontend:
- ui/src/pages/PluginsPage.tsx         (community badge + confirm modal)
- ui/src/api.ts                        (install call passes `confirmed`)
- ui/src/i18n/locales/{fr,en}.json     (community badge label + confirm dialog copy)

Data:
- plugins/registry.json                (add sha256 + owner to every entry)

Docs:
- docs/technical/plugin-development.md  (SHA256 in PR workflow)
```

## Backward compatibility

- **Registry without `sha256`**: rejected at load. Bundled registry is
  updated atomically with this PR, so existing entries are valid from
  day 1.
- **Tar flags**: GNU tar on Linux supports all three flags since the
  early 2000s. macOS dev machines may use BSD tar where flags differ —
  CI runs on Linux so prod is fine; local `npm test` on macOS may need
  a guard or a stub. To verify during impl.
- **Backup restore behaviour change**: legitimate backups created by
  Sowel today contain only files matching the extension whitelist (we
  control the export format). No legitimate backup should be rejected.
  Old backups with unexpected files will see those files skipped — log
  surfaces this clearly.
- **Plugin install API**: existing callers (no `confirmed` field) still
  work for official plugins. Community plugins return 409 — UI handles
  the new path, programmatic callers must opt in.
