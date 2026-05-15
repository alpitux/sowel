# Spec 105 — Implementation Plan

Single PR, ordered tasks. Each task in the order listed; no parallelism between tasks.

## Task breakdown

### Task 0 — Branch setup

- [ ] `git checkout main && git pull`
- [ ] `git checkout -b feat/wan-hardening`
- [ ] `git branch --show-current` returns `feat/wan-hardening`

### Task 1 — Add `@fastify/helmet` dependency

- [ ] `npm install --save @fastify/helmet@^13`
- [ ] Verify `package-lock.json` updated.
- [ ] `npx tsc --noEmit` still passes.

### Task 2 — S6 — Auth-by-default

This goes first because all subsequent route protection assumes the global hook is in place.

- [ ] Edit `src/auth/auth-middleware.ts`:
  - [ ] Export `PUBLIC_ROUTES` constant set.
  - [ ] Add second `preHandler` hook that enforces auth on `/api/v1/*` except whitelist.
- [ ] Verify in dev: hitting `GET /api/v1/devices/suggest` without a token returns 401 (previously 200).
- [ ] Verify in dev: `GET /api/v1/auth/status` without token still works.
- [ ] Write regression test `src/api/auth-by-default.test.ts` (see architecture.md).
- [ ] Run `npx vitest run src/api/auth-by-default.test.ts` — passes.

### Task 3 — S2 — Security headers

- [ ] Edit `src/api/server.ts`:
  - [ ] Import and register `@fastify/helmet` after CORS, before routes.
  - [ ] Configure CSP per architecture.md.
  - [ ] Add HSTS conditional hook.
- [ ] Write integration test `src/api/headers.test.ts`:
  - [ ] Asserts all security headers present on `/api/v1/health`.
  - [ ] Asserts HSTS absent on HTTP, present when `x-forwarded-proto: https`.
- [ ] Manual UI verification: launch backend + UI, browse all main pages (dashboard, equipments, zones, settings), check browser console for CSP violations.

### Task 4 — S3 — CORS defaults

- [ ] Edit `src/config.ts`:
  - [ ] Default `CORS_ORIGINS` to `http://localhost:3000,http://localhost:5173`.
- [ ] Edit `src/index.ts`:
  - [ ] Add boot-time warn logs when CORS is wildcard.
- [ ] Add test `src/config.test.ts`:
  - [ ] Default is the localhost list.
  - [ ] Explicit env var overrides.

### Task 5 — S1 — WebSocket hardening

- [ ] Edit `src/api/websocket.ts`:
  - [ ] Add `extractBearer` and `extractFromSubprotocol` helpers.
  - [ ] Validate `Origin` header.
  - [ ] Refuse anonymous connections.
- [ ] Edit `ui/src/store/useWebSocket.ts` (or equivalent):
  - [ ] Replace `?token=` with `Sec-WebSocket-Protocol: bearer.<token>`.
- [ ] Add test `src/api/websocket.test.ts`:
  - [ ] Connection without token refused (4001).
  - [ ] Connection with bad Origin refused (4003).
  - [ ] Connection with valid `bearer.` subprotocol accepted.
- [ ] Manual UI verification: WebSocket connects, events stream, reconnect on close works.

### Task 6 — S4 — Container hardening (Dockerfile + entrypoint + compose)

This goes last because it affects runtime, not code logic, and needs the most thorough end-to-end testing.

- [ ] Create `docker-entrypoint.sh` at repo root per architecture.md.
- [ ] `chmod +x docker-entrypoint.sh` (track exec bit in git).
- [ ] Edit `Dockerfile`:
  - [ ] Add `gosu` to apt installs.
  - [ ] Create `sowel` user (uid 1000) via `groupadd` + `useradd`.
  - [ ] Copy `docker-entrypoint.sh` to `/usr/local/bin/`.
  - [ ] Replace `CMD ["node", "dist/index.js"]` with `ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]` + `CMD ["node", "dist/index.js"]`.
  - [ ] **Do not** add `USER` directive (entrypoint handles it).
- [ ] Edit `docker-compose.yml`:
  - [ ] Remove `docker.sock` line.
  - [ ] Add a comment pointing to the override file.
- [ ] Create `docker-compose.override.example.yml` per architecture.md.
- [ ] Edit `src/core/update-manager.ts`:
  - [ ] Add `checkDockerAvailability` method.
  - [ ] Make `startUpdate` throw `UpdateError(503, ...)` when unavailable.
- [ ] Edit `src/api/routes/system.ts`:
  - [ ] Ensure `dockerAvailable` field is accurate in `GET /system/version` response.
- [ ] Edit `ui/src/pages/Settings.tsx` (or wherever the update button lives):
  - [ ] Disable "Update now" when `dockerAvailable` is false.
  - [ ] Tooltip: "Self-update is opt-in. See docker-compose.override.example.yml in the Sowel repo."
- [ ] **Fresh install test**:
  - [ ] `docker build -t sowel:test .`
  - [ ] `docker run --rm sowel:test id` → uid=1000, gid=1000.
  - [ ] `docker compose up -d` (with the new compose, no override) → Sowel boots, Update button disabled.
  - [ ] `docker exec sowel ls -la /app/data` → owned by sowel:sowel.
  - [ ] Copy override file, `docker compose up -d`, Update button enables.
- [ ] **Upgrade test (critical)**: simulate a v1.6.5 → v1.7.0 upgrade.
  - [ ] Start a Sowel v1.6.5 container, create some data (admin user, a zone, an equipment), verify volumes are root-owned (`docker exec -u root sowel-old ls -la /app/data`).
  - [ ] Stop container.
  - [ ] Replace image with the new build, `docker compose up -d`.
  - [ ] Verify: Sowel boots without errors, all previous data preserved, volumes now sowel-owned, no manual command needed.
- [ ] Document the (unlikely) custom `user:` override case in CHANGELOG.

### Task 7 — Documentation

- [ ] Update `docs/technical/architecture.md` — Authentication section: mention auth-by-default + PUBLIC_ROUTES.
- [ ] Update `docs/technical/deployment.md` — non-root container (transparent upgrade) + self-update opt-in.
- [ ] Update `docs/specs-index.md` — add 105 entry.
- [ ] Update `SECURITY_AUDIT_WAN.md` — mark §6 items as `[x]` for the ones shipped (S1, S2, S3, S4, S6).
- [ ] Update `SECURITY_AUDIT.md` — mark H1, H3, H4, H5, CORS finding as `[x]`.

### Task 8 — Validation gate

- [ ] `npx tsc --noEmit` — zero errors.
- [ ] `cd ui && npx tsc -b --noEmit` — zero errors.
- [ ] `npx vitest run` — all tests pass.
- [ ] `npx eslint src/ --ext .ts` — zero errors.
- [ ] Manual end-to-end test against a fresh `docker compose up -d`:
  - [ ] First-time setup works.
  - [ ] Login works.
  - [ ] Dashboard streams real-time data via WS (subprotocol auth).
  - [ ] CSP doesn't break any page.
  - [ ] Update button disabled by default; enabled with override.

### Task 9 — Commit + PR

- [ ] `git branch --show-current` returns `feat/wan-hardening` (verify before commit).
- [ ] `git add` only the intended files.
- [ ] Commit message (conventional, scope `core`):

  ```
  feat(core): WAN hardening (spec 105)

  - Auth-by-default Fastify hook + PUBLIC_ROUTES whitelist + regression test
  - @fastify/helmet with CSP/HSTS/X-Frame-Options/Referrer-Policy
  - CORS default tightened from * to localhost (warn log on wildcard)
  - WebSocket: mandatory auth, Origin validation, token via Sec-WebSocket-Protocol
  - Dockerfile non-root (uid 1000) via entrypoint + gosu, docker.sock opt-in
  ```

- [ ] `git push -u origin feat/wan-hardening`
- [ ] `gh pr create --title "feat: WAN hardening (spec 105)" --body "..."` with:
  - Summary
  - Changes (per-section)
  - Test plan (checkboxes for typecheck, vitest, manual UI verification, Docker build + upgrade test)
  - Upgrade notes (transparent for default compose; flag for `user:` override case)

## Test Plan

### Modules to test

- `src/auth/auth-middleware.ts` — global preHandler + PUBLIC_ROUTES enforcement
- `src/api/websocket.ts` — auth + Origin validation
- `src/api/server.ts` — header presence
- `src/config.ts` — CORS defaults
- `src/core/update-manager.ts` — graceful degradation
- Dockerfile + entrypoint — end-to-end upgrade transparency (manual)

### Scenarios per module

| Module                              | Scenario                                                              | Expected                                                    |
| ----------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------- |
| `auth-middleware` (auth-by-default) | Unauthenticated GET to non-public route                               | 401                                                         |
| `auth-middleware`                   | Unauthenticated GET to `/api/v1/health`                               | 200                                                         |
| `auth-middleware`                   | Unauthenticated GET to `/api/v1/auth/setup`                           | Depends on handler (403 if users exist)                     |
| `auth-middleware`                   | Authenticated GET to non-public route                                 | Passes through to handler                                   |
| `auth-middleware` (regression test) | All `/api/v1/*` routes enumerated; none unprotected outside whitelist | All 401 except PUBLIC_ROUTES                                |
| `websocket`                         | WS connect without `Authorization` and without subprotocol            | Close 4001                                                  |
| `websocket`                         | WS connect with `Authorization: Bearer <invalid>`                     | Close 4001                                                  |
| `websocket`                         | WS connect with `Sec-WebSocket-Protocol: bearer.<valid>`              | Accepted, subscribed to `system` topic                      |
| `websocket`                         | WS connect with bad `Origin`                                          | Close 4003                                                  |
| `websocket`                         | WS connect with whitelisted `Origin` + valid token                    | Accepted                                                    |
| `server` — headers                  | GET `/api/v1/health`                                                  | All security headers present                                |
| `server` — headers                  | GET with `x-forwarded-proto: https`                                   | HSTS header present                                         |
| `server` — headers                  | GET over plain HTTP                                                   | HSTS absent                                                 |
| `config` — CORS                     | No env var                                                            | Defaults to localhost:3000,localhost:5173                   |
| `config` — CORS                     | `CORS_ORIGINS=https://sowel.exemple.com`                              | Single origin                                               |
| `update-manager`                    | `docker.sock` available                                               | `startUpdate` proceeds                                      |
| `update-manager`                    | `docker.sock` unavailable                                             | `startUpdate` throws `UpdateError` 503                      |
| Dockerfile + entrypoint (manual)    | Fresh `docker compose up -d`                                          | Container boots, uid=1000, volumes owned by sowel           |
| Dockerfile + entrypoint (manual)    | Upgrade from v1.6.5 (root volumes) to new image                       | Container boots without manual chown, all data preserved    |
| Dockerfile + entrypoint (manual)    | Compose with `user: 1000:1000` override on root-owned volumes         | Container crashes on write (expected, documented edge case) |

### Manual verification

Beyond automated tests:

- Browse the full UI under the new CSP. Verify dashboard, equipments, zones, settings, plugins, backup pages all render without console errors.
- WebSocket reconnects automatically after a server restart, still using the new subprotocol auth.
- Fresh `docker compose up -d` from a clean state, configure first admin, no errors. Volume permissions correct.
- **Upgrade test**: spin up a real v1.6.5 instance in a test VM, populate with realistic data (a few zones, equipments, plugins installed), then upgrade to the new image. Verify no permission error, no data loss, no manual command.

## Estimated effort

- Task 0-1: 30 min
- Task 2 (auth-by-default): 1 day (test + verify no regression on each route)
- Task 3 (helmet): 0.5 day (CSP tuning is the time-consuming part)
- Task 4 (CORS): 1 hour
- Task 5 (WS): 1 day (UI changes + tests)
- Task 6 (Docker): 1 day (entrypoint + upgrade test is the most delicate)
- Task 7 (docs): 0.5 day
- Task 8 (validation): 0.5 day
- Task 9 (commit/PR): 30 min

**Total: ~4.5 working days.** Add 20-30% buffer for unforeseen CSP / WS / Docker upgrade issues.
