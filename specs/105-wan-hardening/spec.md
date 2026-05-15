# Spec 105 — WAN Hardening

## Context

The 2026-05-03 application audit (`SECURITY_AUDIT.md`) and the 2026-05-15 WAN-specific analysis (`SECURITY_AUDIT_WAN.md`) identified a set of vulnerabilities that are tolerable on a trusted LAN but unacceptable when Sowel is exposed to the public Internet.

Two WAN topologies exist today:

- **Cloudflare Tunnel** (mainteneur, advanced users): TLS terminated at the edge, optional Cloudflare Access SSO.
- **Direct port-forward** (general public): NAT rule from the home router to `192.168.x.x:3000`, often HTTP only, no WAF, no SSO.

This spec closes the highest-impact gaps so both topologies become defensible by default, without requiring users to know that they must harden a service before exposing it. C3 (backup encryption) and W7 (password re-prompt on sensitive actions) are intentionally **out of scope**: see below for rationale.

## Goals

1. Block the two main WAN attack chains that remain after spec 089:
   - **XSS / clickjacking chain** → solved by helmet + CSP + strict CORS.
   - **CSRF / info-disclosure via WebSocket chain** → solved by mandatory WS auth + Origin validation.
   - **Privilege escalation to host chain** → solved by non-root container + opt-in `docker.sock`.
2. Make "auth by default" the structural invariant for API routes, so future regressions are impossible (any new route is protected unless explicitly listed as public).
3. Stay backwards-compatible: existing LAN deployments must keep working. **No manual migration step on upgrade.**

## In scope

| #   | Item                                                                                 | Audit ref    |
| --- | ------------------------------------------------------------------------------------ | ------------ |
| S1  | WebSocket: mandatory auth, `Origin` validation, token via header (not query)         | H4 + W3      |
| S2  | `@fastify/helmet` with CSP, HSTS (HTTPS only), X-Frame-Options DENY, Referrer-Policy | H3           |
| S3  | CORS: refuse wildcard `*` when origin is non-loopback, default to safe list          | CORS finding |
| S4  | Dockerfile non-root (UID 1000) via entrypoint + `gosu` + `docker.sock` opt-in        | H1           |
| S6  | Auth-by-default Fastify hook + explicit public-route whitelist + regression test     | H5           |

(S5 was scoped out — see Out of scope.)

## Out of scope

- **S5 — Password re-prompt on sensitive actions (W7)** — deferred to a separate spec 106. Reasons: (a) overlap with S2 (CSP blocks the XSS vector that would steal a bearer) and S6 (no forgotten unprotected route remains), (b) breaks legitimate automation flows that use API tokens (`swl_...`) for backup export or update scripts, (c) UI churn (password modal on 5+ call-sites) introduces its own bug surface. Will be revisited if a real attack vector emerges that S2 + S6 do not cover.
- **C3 backup encryption** — deferred. Home Assistant and equivalents ship unencrypted by default; the WAN risk is not the primary threat model.
- **Mode `EXPOSURE_MODE=wan`** — separate spec (would force strict profile + UI banner). Belongs to a configuration feature, not a hardening fix.
- **H2 digest pinning** — separate spec, depends on release pipeline changes.
- **TLS terminé en natif dans Sowel** — Sowel reste un service HTTP, le TLS reste de la responsabilité du reverse proxy / tunnel. Documentation only.
- **Password policy upgrade** (6 → 12) — separate small spec.
- **Refresh token TTL reduction** — separate small spec.
- **JWT algorithm explicitness** — separate small spec.

## User stories

### Mainteneur (Cloudflare Tunnel + Access)

> En tant que mainteneur, je veux que mon instance Sowel résiste aux attaques XSS / clickjacking / WS-based même si Cloudflare Access n'est pas activé en amont.

### Auto-hébergeur grand public (port-forward direct)

> En tant qu'utilisateur qui a suivi un tuto pour exposer Sowel via port-forward, je veux que mon instance ne soit pas trivialement détournée par un bot Internet, et que la mise à jour vers cette version sécurisée ne nécessite aucune commande shell de ma part.

### Contributeur

> En tant que contributeur, je veux qu'il soit impossible d'ajouter une route API qui oublie l'authentification: l'oubli doit casser un test automatique et bloquer le PR.

## Acceptance criteria

### S1 — WebSocket hardening

- [ ] Connection to `/ws` without a `token` query param, `Authorization` header, or `Sec-WebSocket-Protocol` subprotocol is **refused** with close code 4001.
- [ ] Connection with an `Origin` header not in the CORS whitelist is **refused** with close code 4003.
- [ ] Token can be provided via `Authorization: Bearer <token>` header **or** `Sec-WebSocket-Protocol: bearer.<token>` subprotocol (for browser clients that cannot set headers on WS).
- [ ] Existing UI client adapts to use the subprotocol path; query-param token is removed from the client code.
- [ ] Legacy query-param token is rejected (no silent fallback).
- [ ] Unit test: anonymous connection refused. Bad-Origin connection refused. Valid header-auth connection accepted.

### S2 — Security headers

- [ ] `@fastify/helmet` registered after CORS, before routes.
- [ ] CSP set with `default-src 'self'`, `script-src 'self'`, `style-src 'self' 'unsafe-inline'` (Tailwind needs inline), `connect-src 'self' wss:` (so the WS connection works against the host).
- [ ] `Strict-Transport-Security: max-age=31536000; includeSubDomains` set **only** when the request arrived over HTTPS (detected via `X-Forwarded-Proto: https` or direct TLS — won't break local HTTP setups).
- [ ] `X-Frame-Options: DENY`.
- [ ] `Referrer-Policy: no-referrer`.
- [ ] `X-Content-Type-Options: nosniff`.
- [ ] Integration test: a request to `/health` returns all expected headers.
- [ ] Manual verification: UI loads correctly with the new CSP (fonts, icons, manifest PWA, WebSocket).

### S3 — CORS defaults

- [ ] Default `CORS_ORIGINS` value changes from `*` to `http://localhost:3000,http://localhost:5173`.
- [ ] If the environment variable `CORS_ORIGINS=*` is set explicitly, server emits a `warn` log on startup: "CORS wildcard is dangerous when exposed WAN. Restrict to known origins."
- [ ] `API_HOST=0.0.0.0` (current default) combined with `CORS_ORIGINS=*` triggers an additional `warn` log.
- [ ] Existing users who set `CORS_ORIGINS=https://sowel.exemple.com` see no change.
- [ ] Unit test: cross-origin request from non-whitelisted origin is rejected.

### S4 — Container hardening

- [ ] `Dockerfile` creates a `sowel` user (uid 1000) and installs `gosu`.
- [ ] A new `docker-entrypoint.sh` is shipped:
  - When the container starts as root, it runs `chown -R sowel:sowel /app/data /app/plugins` (idempotent) and then `exec gosu sowel "$@"`.
  - When the container is already started under a non-root user, the entrypoint exec the command directly (skip chown).
- [ ] No `USER` directive in the Dockerfile — the entrypoint controls privilege drop.
- [ ] `docker compose up -d` on a fresh install: Sowel boots, `docker exec sowel id` returns `uid=1000`, volumes are owned by 1000.
- [ ] **Upgrade from v1.6.5**: `docker compose pull && docker compose up -d` works without any manual command. The entrypoint auto-chowns the existing root-owned volumes on first boot. Verified end-to-end against a real v1.6.5 → v1.7.0 upgrade in a test VM.
- [ ] `docker-compose.yml` no longer mounts `/var/run/docker.sock` by default.
- [ ] A new `docker-compose.override.example.yml` is shipped as a template for opt-in self-update.
- [ ] `UpdateManager` gracefully degrades: if `dockerode` cannot reach the socket, self-update endpoint returns 503 with a clear message pointing to the override file.
- [ ] `GET /api/v1/system/version` surfaces `dockerAvailable: false` when the socket is not mounted; UI disables the "Update now" button with a tooltip.
- [ ] CHANGELOG documents the change as transparent for users with default compose; users with a custom `user:` override must adjust manually.

### S6 — Auth-by-default

- [ ] `registerAuthMiddleware` registers a global `preHandler` hook that **requires** `request.auth` on all `/api/v1/*` routes.
- [ ] A `PUBLIC_ROUTES` constant lists the explicit exceptions: `/api/v1/health`, `/api/v1/auth/status`, `/api/v1/auth/setup`, `/api/v1/auth/login`, `/api/v1/auth/refresh`. Static UI routes are unaffected (don't match `/api/v1/*`).
- [ ] Per-route `preHandler` calls become redundant in route files — they can stay (harmless) but are no longer the source of truth.
- [ ] Existing route files keep working without modification.
- [ ] **Regression test**: an integration test enumerates all routes registered with Fastify (`app.printRoutes()` introspection) and asserts that every route either matches a `PUBLIC_ROUTES` entry or returns 401 on unauthenticated GET.
- [ ] `/api/v1/devices/suggest` (known unprotected route) is no longer accessible anonymously after this change.

## Edge cases

- **CORS preflight from a Tauri / Electron wrapper** — out of scope today, the warn log on `*` is friendly enough.
- **A user has set `CORS_ORIGINS=*` intentionally for testing** — keeps working with a warn log.
- **A user has `docker.sock` mounted via their own custom compose** — keeps working; the change is only to the shipped default.
- **A user has `user:` override in `docker-compose.override.yml`** — entrypoint detects non-root start and skips chown; volume ownership is the user's responsibility. Documented in CHANGELOG.
- **Bind mount on read-only filesystem (NFS)** — chown silently fails (`|| true` in the entrypoint); Sowel may then fail to write SQLite. Edge case, documented as unsupported in CHANGELOG.
- **Setting changes that require restart** — restart already triggers `system.restart_required`; if S4 makes self-restart opt-in, the UI must show a "manual restart required" tooltip when `docker.sock` is unavailable.

## Open questions

1. **CSP `connect-src wss:` vs explicit host** — explicit host is safer but requires `process.env.PUBLIC_URL` or equivalent. Decision: start with `wss:` for compatibility, tighten in a follow-up.
2. **Should the entrypoint chown also handle `/app/data/logs` rotation files left as root?** — yes, `chown -R` covers all subdirs. Confirmed.
3. **Does `gosu` add notable image size?** — ~2 MB (negligible vs current ~950 MB image).

## Non-goals

- This spec does not introduce a "WAN mode" config flag.
- This spec does not add password re-prompt on sensitive actions (deferred to spec 106).
- This spec does not change the rate-limit values (already adequate for `/auth/login`).
- This spec does not migrate to opaque session tokens (JWT bearer stays).
- This spec does not add a CSRF token to mutation endpoints (bearer-in-header model is not CSRF-vulnerable; helmet + CORS strict is enough).
- This spec does not encrypt backups.

## Success metric

After merge, a fresh Sowel install exposed via reverse-proxy + TLS without any custom configuration should pass an external pen-test of the following:

- WebSocket anonymous connection refused.
- All security headers present in `/health` response.
- CORS cross-origin POST refused.
- `/devices/suggest` returns 401.
- Process is not running as root (`docker exec sowel id` returns `uid=1000`).
- `POST /api/v1/system/update` returns 503 when `docker.sock` not mounted.

Upgrade from v1.6.5 to the new version should require zero manual commands for users on default compose.
