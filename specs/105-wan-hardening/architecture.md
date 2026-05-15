# Spec 105 — Architecture

## Overview of changes

| Layer      | Module                                      | Change                                                                            |
| ---------- | ------------------------------------------- | --------------------------------------------------------------------------------- |
| Container  | `Dockerfile`                                | Add `gosu`, create `sowel` user (uid 1000), copy entrypoint. No `USER` directive. |
| Container  | `docker-entrypoint.sh` (new)                | Idempotent chown of `/app/data` and `/app/plugins`, then `exec gosu sowel`.       |
| Container  | `docker-compose.yml`                        | Remove default `docker.sock` mount.                                               |
| Container  | `docker-compose.override.example.yml` (new) | Template for opt-in self-update.                                                  |
| API server | `src/api/server.ts`                         | Register `@fastify/helmet`.                                                       |
| API server | `src/api/websocket.ts`                      | Mandatory auth, Origin validation, header/subprotocol token.                      |
| API server | `src/auth/auth-middleware.ts`               | Add `PUBLIC_ROUTES` whitelist + global preHandler enforcing auth.                 |
| Config     | `src/config.ts`                             | `CORS_ORIGINS` default changes; warn logs.                                        |
| Update     | `src/core/update-manager.ts`                | Graceful degradation when `docker.sock` unavailable.                              |
| UI         | `ui/src/store/useWebSocket.ts`              | Pass token via `Sec-WebSocket-Protocol` instead of query.                         |

**No SQLite migration needed.**

---

## S1 — WebSocket hardening

### Current state ([src/api/websocket.ts:168-188](../../src/api/websocket.ts#L168-L188))

```ts
app.get("/ws", { websocket: true }, (socket, request) => {
  const token = new URL(request.url, ...).searchParams.get("token");
  if (token) { /* verify */ }
  // Falls through — anonymous client accepted
});
```

### Target state

```ts
app.get("/ws", { websocket: true }, (socket, request) => {
  // 1. Origin validation
  const origin = request.headers.origin;
  if (origin && !corsOrigins.includes(origin) && !corsOrigins.includes("*")) {
    socket.close(4003, "Origin not allowed");
    return;
  }

  // 2. Token extraction (header preferred, subprotocol fallback for browsers)
  const token =
    extractBearer(request.headers.authorization) ??
    extractFromSubprotocol(request.headers["sec-websocket-protocol"]);

  if (!token) {
    socket.close(4001, "Authentication required");
    return;
  }

  // 3. Verify
  try {
    if (token.startsWith("swl_") || token.startsWith("wch_") || token.startsWith("cbl_")) {
      if (!authService.verifyApiToken(token)) {
        socket.close(4001, "Invalid token");
        return;
      }
    } else {
      authService.verifyAccessToken(token);
    }
  } catch {
    socket.close(4001, "Invalid token");
    return;
  }
  // ... rest unchanged
});
```

### UI client adapter ([ui/src/store/useWebSocket.ts])

Current: `new WebSocket(`${url}/ws?token=${token}`)`.

Target: `new WebSocket(`${url}/ws`, [`bearer.${token}`])`. The browser sends `Sec-WebSocket-Protocol: bearer.<token>`. Server reads it, strips the `bearer.` prefix, validates as JWT or API token.

### Subprotocol design

We use `bearer.<token>` (single subprotocol with embedded token) rather than two-step subprotocol negotiation because:

- It's a single round-trip.
- The server can respond with the same subprotocol string to acknowledge.
- Token doesn't appear in `Origin`/`Referer`/proxy logs (subprotocol is in the upgrade headers).

Caveat: API tokens (`swl_...`) work fine. JWT access tokens contain `.` — must URL-encode or use a different separator. Choice: split on the **first** `.` only:

```ts
function extractFromSubprotocol(header: string | undefined): string | null {
  if (!header) return null;
  const proto = header
    .split(",")
    .map((s) => s.trim())
    .find((p) => p.startsWith("bearer."));
  if (!proto) return null;
  return proto.slice("bearer.".length); // keeps the rest of the JWT intact
}
```

### Error codes

| Code | Reason                            | When                             |
| ---- | --------------------------------- | -------------------------------- |
| 4001 | Authentication required / invalid | No token / verify failed         |
| 4003 | Origin not allowed                | `Origin` header not in whitelist |

---

## S2 — Security headers (`@fastify/helmet`)

### Registration order ([src/api/server.ts:139-160](../../src/api/server.ts#L139-L160))

```ts
await app.register(cors, { origin: corsOrigins, ... });
await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind requires
      imgSrc: ["'self'", "data:"], // PWA icons
      connectSrc: ["'self'", "wss:"], // WebSocket
      fontSrc: ["'self'"],
      manifestSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  strictTransportSecurity: false, // Set conditionally below
  frameguard: { action: "deny" },
  referrerPolicy: { policy: "no-referrer" },
  noSniff: true,
});

// HSTS only when HTTPS detected
app.addHook("onSend", (req, reply, payload, done) => {
  const proto = req.headers["x-forwarded-proto"] ?? ((req.socket as any).encrypted ? "https" : "http");
  if (proto === "https") {
    reply.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  done(null, payload);
});
```

### Dependency

Add `@fastify/helmet` to `package.json` (pin version compatible with Fastify 5.x).

### CSP gotchas

- **Vite dev server**: in `npm run dev` (UI), Vite serves on a separate port. CSP for the production build is what matters. Verify the built bundle works.
- **PWA service worker**: `connect-src 'self'` covers same-origin fetch; the service worker registration path is same-origin.
- **GitHub version check**: handled server-side only, no `api.github.com` needed in CSP.

---

## S3 — CORS defaults

### Change in [src/config.ts:91-95](../../src/config.ts#L91-L95)

```ts
cors: {
  origins: env("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173")
    .split(",")
    .map((s) => s.trim()),
},
```

### Boot-time warnings (`src/index.ts`)

```ts
const corsRaw = process.env["CORS_ORIGINS"];
if (corsRaw === "*") {
  logger.warn(
    "CORS is set to wildcard '*'. This is dangerous if Sowel is exposed to the Internet. Restrict CORS_ORIGINS to known origins.",
  );
}
if (
  corsRaw === "*" &&
  process.env["API_HOST"] !== "127.0.0.1" &&
  process.env["API_HOST"] !== "localhost"
) {
  logger.warn(
    "CORS=* combined with API_HOST=0.0.0.0 is the highest-risk configuration. Consider restricting at least one.",
  );
}
```

### Migration

Users currently relying on the default `*` and accessing Sowel from a non-localhost browser (rare in LAN, but possible from a mobile on the same network using `http://192.168.x.x:3000`) need to set `CORS_ORIGINS=http://192.168.x.x:3000` explicitly. Documented in upgrade notes.

### Same-origin case

When the UI and API are served from the same host (the common case — Fastify serves the static UI), CORS doesn't apply: the browser doesn't enforce CORS on same-origin requests. So the default `localhost:3000` covers the typical setup.

---

## S4 — Container hardening (entrypoint + gosu pattern)

### Design rationale

The classical "USER 1000 in Dockerfile" approach breaks upgrades from a previously root-running container: existing volumes are owned by root, the new container can't write, and the user has to run a manual `chown` (often after the container has already crash-looped). This is unacceptable for non-technical users.

We use the **Postgres / MySQL / MariaDB pattern**: the container's `ENTRYPOINT` runs as root briefly, fixes the volume ownership idempotently, and drops to a non-root user via `gosu` before `exec`ing the actual command. This makes the upgrade fully transparent: `docker compose pull && up -d` and nothing else.

### Dockerfile changes

```dockerfile
# Stage 3: Production runtime
FROM debian:trixie-slim
WORKDIR /app

# Install Node.js 20 + Python 3.13 + build tools + gosu
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates python3 python3-venv make g++ gosu \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user (uid 1000)
RUN groupadd -g 1000 sowel && useradd -u 1000 -g 1000 -m -s /bin/bash sowel

# Install prod deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts \
    && npm rebuild better-sqlite3 \
    && apt-get purge -y make g++ && apt-get autoremove -y \
    && rm -rf /root/.npm

# Copy build artifacts
COPY --from=backend-build /app/dist/ dist/
COPY --from=ui-build /app/ui/dist/ ui-dist/
COPY migrations/ migrations/
COPY plugins/registry.json plugins/registry.json
COPY package.json ./

# Prepare directories (will be chowned at runtime by entrypoint)
RUN mkdir -p data plugins

# Entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV NODE_ENV=production
ENV SQLITE_PATH=/app/data/sowel.db

# NO 'USER' directive — entrypoint drops privileges via gosu

EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
```

### New file: `docker-entrypoint.sh`

```bash
#!/bin/bash
# ============================================================
# Sowel container entrypoint
# ============================================================
# - If running as root: chown data/plugins (idempotent) then
#   drop to the sowel user (uid 1000) via gosu.
# - If running as a non-root user (custom compose with `user:`):
#   exec directly without chown.
# ============================================================
set -e

if [ "$(id -u)" = "0" ]; then
  # Idempotent chown — fast no-op if already owned by sowel
  chown -R sowel:sowel /app/data /app/plugins 2>/dev/null || true
  exec gosu sowel "$@"
fi

exec "$@"
```

### docker-compose.yml change

Remove the `docker.sock` line:

```yaml
volumes:
  - sowel-data:/app/data
  - sowel-plugins:/app/plugins
  # self-update is opt-in. To enable, copy docker-compose.override.example.yml
  # to docker-compose.override.yml and run `docker compose up -d`.
```

### New file: `docker-compose.override.example.yml`

```yaml
# ============================================================
# Sowel self-update override
# ============================================================
# Enable in-app self-update by copying this file to
# `docker-compose.override.yml` then `docker compose up -d`.
#
# SECURITY NOTE: Mounting docker.sock gives the Sowel container
# the ability to control Docker on the host. A successful RCE
# against Sowel would escalate to host root. Only enable this
# if you accept the trade-off.
#
# Without this override, you can still update Sowel manually:
#   docker compose pull && docker compose up -d sowel
# ============================================================
services:
  sowel:
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
```

### `UpdateManager` graceful degradation

In `src/core/update-manager.ts`:

```ts
async checkDockerAvailability(): Promise<boolean> {
  try {
    await this.docker.ping();
    return true;
  } catch {
    return false;
  }
}

async startUpdate(...): Promise<void> {
  if (!(await this.checkDockerAvailability())) {
    throw new UpdateError(
      503,
      "Self-update requires docker.sock to be mounted. See docker-compose.override.example.yml.",
    );
  }
  // ... existing flow
}
```

In `GET /api/v1/system/version`, the response already returns `dockerAvailable`. With this change, it will return `false` for the default deployment, and the UI's "Update now" button is disabled with a tooltip pointing to the override file.

### Upgrade transparency

For users upgrading from v1.6.5 (root container) to v1.7.0 (non-root container):

1. `docker compose pull` — new image pulled.
2. `docker compose up -d` — old container stopped, new container started.
3. New container's entrypoint runs as root, observes that `/app/data` and `/app/plugins` are root-owned, runs `chown -R sowel:sowel` (typically completes in <1 second for a normal installation).
4. Entrypoint `exec gosu sowel node dist/index.js` — Sowel runs as uid 1000.
5. Done. No user action.

### Brief root window

The container is root for the duration of the chown (sub-second). `exec gosu` then replaces the root process with the sowel process — no lingering root process in memory.

This matches the security posture of v1.6.5 (which is root throughout the entire lifetime), so it's strictly an improvement, never a regression.

### Edge cases

- **User has `user: 1000:1000` in their override compose** — entrypoint sees non-root, skips chown. If their volumes were created previously as root (from a v1.6.5 install), they need a one-shot `chown` manually. CHANGELOG flags this.
- **Bind mount on NFS or read-only FS** — chown's `|| true` keeps the container alive; Sowel then fails to write SQLite and crashes with a clear errno. Documented as unsupported.
- **Many files in `/app/data` (long log history)** — chown is linear in file count. ~1 sec per 100k files. Acceptable.

---

## S6 — Auth by default

### Current state ([src/auth/auth-middleware.ts](../../src/auth/auth-middleware.ts))

`registerAuthMiddleware` attaches a hook that **populates** `request.auth` if a valid token is found, but does **not refuse** requests with no `request.auth`. Each route file is expected to check.

### Target state

```ts
// src/auth/auth-middleware.ts

export const PUBLIC_ROUTES: ReadonlySet<string> = new Set([
  "/api/v1/health",
  "/api/v1/auth/status",
  "/api/v1/auth/setup",
  "/api/v1/auth/login",
  "/api/v1/auth/refresh",
  // Static UI routes do not start with /api/v1 and are handled by fastifyStatic
]);

export function registerAuthMiddleware(app: FastifyInstance, deps: AuthDeps): void {
  // Existing hook: populate request.auth
  app.addHook("preHandler", async (request) => {
    // ... unchanged: try JWT, then API token, attach to request.auth
  });

  // NEW: enforce auth on all /api/v1/* routes except whitelist
  app.addHook("preHandler", async (request, reply) => {
    if (!request.url.startsWith("/api/v1/")) return;
    const pathname = request.url.split("?")[0];
    if (PUBLIC_ROUTES.has(pathname)) return;
    if (!request.auth) {
      return reply.code(401).send({ error: "Authentication required" });
    }
  });
}
```

### Why this works without changing each route

Per-route `preHandler` calls that also check `request.auth` become redundant but harmless. They will all see `request.auth` populated (or the global hook will have already 401'd).

### Routes whose individual auth-check should be removed

A cleanup pass identifies and removes per-route `if (!request.auth) return 401` boilerplate. This is mechanical and could be done in a follow-up PR if scope creep is a concern. Keep for v1 to minimize churn.

### Regression test

```ts
// src/api/auth-by-default.test.ts
import { describe, it, expect } from "vitest";
import { createTestServer } from "./test-helpers.js"; // builds a minimal Fastify with auth middleware
import { PUBLIC_ROUTES } from "../auth/auth-middleware.js";

describe("Auth by default", () => {
  it("every /api/v1/* route either requires auth or is in PUBLIC_ROUTES", async () => {
    const app = await createTestServer();
    const routes = app.printRoutes({ commonPrefix: false }); // returns string
    const apiPaths = extractPaths(routes).filter((p) => p.startsWith("/api/v1/"));

    for (const path of apiPaths) {
      if (PUBLIC_ROUTES.has(path)) continue;
      // Make an unauthenticated request and assert 401
      const res = await app.inject({ method: "GET", url: path });
      expect(res.statusCode, `Route ${path} should require auth`).toBe(401);
    }
  });
});
```

The test instantiates the server with all routes registered, enumerates them, and for each non-public route asserts that an unauthenticated request gets 401. If a contributor adds a public route by mistake (or forgets a path), the test fails.

### Caveats

- Some routes accept `POST` / `PUT` and may return 400 before 401 if body validation runs first. The test uses `GET` only when possible.
- Static UI fallback (`setNotFoundHandler`) is not affected since it doesn't match `/api/v1/*`.

---

## Configuration impact

### New environment variables

None.

### Changed defaults

| Variable       | Before | After                                         |
| -------------- | ------ | --------------------------------------------- |
| `CORS_ORIGINS` | `*`    | `http://localhost:3000,http://localhost:5173` |

### Compose change

`docker.sock` removed from default compose. Users wanting self-update copy `docker-compose.override.example.yml` to `docker-compose.override.yml`.

---

## Dependencies

```json
{
  "@fastify/helmet": "^13.0.0"
}
```

Pin to a version compatible with current Fastify (5.x). `gosu` added to apt-installed packages (Debian package, no Node dep).

---

## Risks & mitigations

| Risk                                                                | Mitigation                                                                                                   |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| CSP breaks the UI (fonts, icons, WS, dev hot-reload)                | Manual test pass in browser; explicit `connect-src 'self' wss:`; document any CSP-incompatible UI feature.   |
| Existing users break after compose change (self-update disabled)    | Documented in CHANGELOG + tooltip in UI explaining how to re-enable.                                         |
| Volume permission errors on upgrade                                 | Entrypoint chowns idempotently on first boot — zero manual action.                                           |
| User with `user:` override in compose has root-owned legacy volumes | Documented in CHANGELOG: "if you override `user:`, run a one-shot `chown` before upgrade".                   |
| Auth-by-default test catches an existing intentional public route   | Whitelist is reviewed in PR. Each addition requires justification in PR description.                         |
| Subprotocol-based WS auth breaks proxies                            | Test against Cloudflare Tunnel before merge. Fallback to `Authorization` header for non-browser clients.     |
| Entrypoint chown takes long time on huge installations              | Idempotent, runs only when needed (files already owned by sowel = fast no-op via `chown` early exit checks). |
