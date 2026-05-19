# Spec 113 — Implementation plan

Single feature branch `feat/audit-log`. Estimated effort:
**1.5 days** (0.5 core + 0.5 wire points + 0.25 endpoint + 0.25
tests + docs). No UI shipped in this spec.

## Tasks

### Phase 1 — Schema + core service (4 hours)

1. [ ] Add `migrations/010_audit_log.sql` with the schema in
       `architecture.md`. Run `npx vitest run src/core/database.test.ts`
       to confirm migrations still apply cleanly.
2. [ ] Add `AuditEntry`, `AuditEntryRow`, `AuditActorKind`,
       `AuditQueryParams` to `src/shared/types.ts`. No discriminated
       union — `action` is a free string for extensibility.
3. [ ] Create `src/core/audit-logger.ts`: `AuditLogger` class with
       `log()`, `query()`, `purgeOlderThan()` and the static
       `redactSettingMeta()`. Match the shape in `architecture.md`.
4. [ ] Create `src/core/audit-logger.test.ts`: the 8 scenarios from
       `architecture.md` § Tests on an `:memory:` SQLite instance.

### Phase 2 — Wire points (4 hours)

Each wire point is a small edit. Order does not matter; do them
together in one pass so the audit vocabulary stays coherent.

5. [ ] `src/index.ts`: instantiate `AuditLogger`, run
       `purgeOlderThan(365)` at boot, pass to `createServer`.
6. [ ] `src/api/server.ts`: decorate the Fastify app with the audit
       logger so route registrars can access `app.audit`. Augment
       `FastifyInstance` typing in `src/api/types.ts` (or inline in
       `server.ts` with `declare module "fastify"`).
7. [ ] `src/api/routes/auth.ts`: `auth.login.success`,
       `auth.login.failure`, `auth.logout`, `auth.token.refresh`,
       `auth.api_token.create`, `auth.api_token.delete`.
8. [ ] `src/api/routes/users.ts`: `user.create`, `user.update`,
       `user.password_change`, `user.delete`.
9. [ ] `src/api/routes/settings.ts`: `settings.update` on every
       per-key PUT; bulk updates emit one row per key. Use
       `AuditLogger.redactSettingMeta()` for the `meta` field.
10. [ ] `src/api/routes/modes.ts`: `mode.activate`,
        `mode.deactivate`.
11. [ ] `src/api/routes/backup.ts`: `backup.export` (record bytes),
        `backup.restore`.
12. [ ] `src/api/routes/plugins.ts` (or `packages.ts` — check the
        actual filename): `plugin.install`, `plugin.uninstall`,
        `plugin.update`, `plugin.enable`, `plugin.disable`. Record
        version + repo + owner in `meta`.

### Phase 3 — Admin endpoint (2 hours)

13. [ ] Create `src/api/routes/audit.ts`: `GET /api/v1/audit` with
        querystring `actorUserId?`, `actionPrefix?`, `since?`,
        `until?`, `limit?` (max 500), `offset?`. Pre-handler is
        `requireRole("admin")` (same middleware as user management).
        Returns `{ entries: AuditEntryRow[] }`.
14. [ ] Register the route in `src/api/server.ts` alongside the
        other route registrars.

### Phase 4 — Documentation (2 hours)

15. [ ] Add a bullet to the existing
        `### v1.11.1 — 2026-05-19 { #v1-11-1 }` block in
        `docs/release-notes.md` and `.fr.md`. We are batching F03
        and F13 in the same release; both fit naturally under the
        "reliability + security forensics" theme.
16. [ ] Add a row for spec 113 in `docs/specs-index.md` and
        `.fr.md` under V1.11.
17. [ ] Update `docs/technical/api-reference.md`: new "Audit log"
        section documenting `GET /api/v1/audit`, the querystring
        params, response shape, admin-only access, and the action
        vocabulary table from `spec.md` § Scope.
18. [ ] Mark acceptance criteria as `[x]` in
        `specs/113-audit-log/spec.md` and tasks as `[x]` in this
        file.

### Phase 5 — Validate (15 min)

19. [ ] `npx tsc --noEmit` clean.
20. [ ] `npx eslint src/ --ext .ts` clean.
21. [ ] `npx vitest run` green. Expected total: 612 + ~10 new = 622.
22. [ ] `cd ui && npx tsc -b --noEmit` clean (no UI change, sanity).

### Phase 6 — Ship (15 min)

23. [ ] Commit on `feat/audit-log` with conventional message
        `feat(audit): add audit_log table and admin endpoint (spec 113)`.
24. [ ] Push, open PR via `gh pr create`. Body lists the wire points
        and the test plan.
25. [ ] Wait for explicit merge approval. Release is batched with
        F03 in v1.11.1, triggered manually later.

## Test plan

Two layers: unit on the logger, one integration via Fastify
`inject()` to confirm a full round-trip works end-to-end.

### Unit (vitest, in-memory SQLite)

| #   | Scenario                                                               | Expected                                                                         |
| --- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | `log()` inserts a row                                                  | `query()` finds it with all fields preserved                                     |
| 2   | `log()` with a thrown DB (mock `prepare` to throw on `.run`)           | No exception escapes; `logger.error` is called with the action and the err       |
| 3   | `query()` filters by `actorUserId`                                     | Only entries with matching user id are returned                                  |
| 4   | `query()` filters by `actionPrefix = "auth."`                          | Returns entries starting with `auth.`, ignores `user.*` and `settings.*`         |
| 5   | `query()` filters by `since` and `until` (ISO 8601)                    | Returns only entries inside the range                                            |
| 6   | `query({ limit: 9999 })` is capped                                     | Returns at most `MAX_LIMIT = 500` rows                                           |
| 7   | `query({ offset: 100 })` skips the first 100                           | Pagination works in DESC timestamp order                                         |
| 8   | `purgeOlderThan(30)`                                                   | Rows with `timestamp < now - 30 days` are deleted; newer kept; returns the count |
| 9   | `redactSettingMeta("integration.netatmo.refresh_token", "old", "new")` | Returns `{ valueRedacted: true }`                                                |
| 10  | `redactSettingMeta("home.latitude", "48.8", "48.9")`                   | Returns `{ oldValue: "48.8", newValue: "48.9" }`                                 |
| 11  | JSON round-trip of `meta` through insert + query                       | The Object structure is preserved (no truncation, no double-encoding)            |

### Integration (Fastify inject(), real DB on `:memory:`)

| #   | Scenario                                                                                                               | Expected                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 12  | POST `/api/v1/auth/login` with valid credentials → GET `/api/v1/audit` with admin token                                | The response contains one entry with `action: "auth.login.success"`, `ip` populated |
| 13  | GET `/api/v1/audit` without admin role                                                                                 | 403 Forbidden                                                                       |
| 14  | Two successive PUT `/api/v1/settings/home.latitude` with different values → GET `/api/v1/audit?actionPrefix=settings.` | Returns 2 entries with `meta.oldValue` and `meta.newValue`, newest first            |

Total: ~14 cases. ~10 net new on top of the 612 baseline (some
scenarios share setup).

### What is not tested

- The exhaustive list of every wire point (login / logout / refresh /
  modes / backup / plugins). Audit calls are one-liner pattern at
  each route handler; we cover the _pattern_ with scenarios 12-14 and
  the _logger contract_ with 1-11. Wire-point regressions would show
  up as missing rows in production, easy to catch at scale.
- UI behaviour: no UI in this spec.

## Rollback strategy

If a regression appears after merge:

- Revert the commit on main. Migration 010 stays in place (the table
  is empty-ish, harmless), but the route + logger code disappears.
- The orphaned table can be left in `data/sowel.db` or dropped via
  a follow-up migration. Not load-bearing for any other module.

No data loss risk: audit entries are derived from operations that
keep happening, so a re-roll starts a fresh trail without affecting
business state.

## Out of scope, for future specs

- **UI page**: `/admin/audit` with a filterable table. Reuses the
  endpoint, no backend change needed.
- **Tamper detection**: hash-chained entries (each row carries the
  hash of the previous), checked at boot. Detects post-hoc edits.
- **Real-time WebSocket push**: live tail of audit events for an
  open admin page.
- **External SIEM forwarding**: shipping entries to syslog / Loki /
  Splunk for centralised monitoring.
