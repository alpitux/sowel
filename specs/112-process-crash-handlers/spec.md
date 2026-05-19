# Spec 112 — Process crash handlers (uncaughtException + unhandledRejection)

> Defensive hardening. Two `process.on(...)` listeners plus a small
> module that holds them. No new tables, no new event types, no UI, no
> breaking change for plugins.

## Problem

After spec 111 every plugin runs through `wrapPluginMethods`, which
catches throws in `start`, `stop`, `executeOrder`, `refresh`,
`getStatus`, etc. and either rethrows (callers need them) or swallows
with a typed fallback (recovery without crash). That covers the
nominal plugin lifecycle.

Three other classes of throw still escape to the top of the Node.js
process and tear it down without a trace:

1. **`setInterval` / `setTimeout` callbacks in the core**. Pollers,
   schedulers (`croner`), debouncers in the recipe engine, retry
   timers in the equipment manager. A throw inside a timer callback
   bypasses the wrapper.
2. **Async event handlers with unhandled rejections**. WebSocket
   `onMessage` handlers, MQTT publisher `publish()` calls, InfluxDB
   writes that throw async. Any `await fn()` without `try/catch`
   produces an `UnhandledPromiseRejection`.
3. **Native modules and node-level errors**. `better-sqlite3`
   throwing on a corrupted DB, `mqtt.js` socket errors, OS signals
   coming through child processes — none of which we can wrap from
   user code.

In all three cases the process today exits with no log entry in
`data/logs/sowel.N.log`. Docker then restarts the container per
`unless-stopped`, the symptom shows up as "Sowel restarted at 3:47 AM"
in the activity feed, but the cause is invisible. Audit F03, High
severity, S effort, Reliability category.

## Goal

Install two process-level listeners as early as the pino logger is
available, both backed by `logger.fatal({ err }, ...)` with structured
context (Error stack, sanitised by pino's existing redact paths), then
exit(1) after a brief flush delay so Docker's restart policy reboots
the container cleanly.

The fatal log line, once shipped to stdout AND to the rolling file
transport, is enough to reconstruct what happened at 3:47 AM without
reading code.

## Non-goals

- **Recovery**: no attempt to resume after `uncaughtException`. The
  process state is undefined after an uncaught throw; recovery would
  hide subtle bugs and create heisenbugs. Always exit.
- **Graceful integration shutdown** on crash: not attempted. The
  `IntegrationRegistry.stopAll()` path is for clean SIGINT/SIGTERM
  shutdown only. On crash, integrations remain in whatever state
  they were; Docker restart will re-init them on next boot.
- **External alerting** (Telegram, ntfy, webhook) on crash: not in
  scope. The notification publishers themselves could be the source
  of the throw; we cannot rely on them at crash time.
- **Bootstrap-window coverage**: the `cleanStalePidFile()`, config
  load, db open, timezone detection, and logger creation all run
  before the logger exists. A throw in that window already lands in
  the existing `main().catch()` at the bottom of `src/index.ts`,
  which writes a stderr JSON line and exits. We do not duplicate that
  path.
- **Wrapping every `setInterval` / `setTimeout` in user code**: out
  of scope. F03 is the safety net of last resort, not a replacement
  for proper local error handling inside callbacks.
- **Capturing `warning` or `beforeExit` process events**: not in
  scope; warnings are informational and beforeExit is a graceful
  signal, neither belongs in the crash path.

## Approach

A new module `src/core/process-crash-handlers.ts` exporting one
function:

```ts
export function installProcessCrashHandlers(logger: Logger): void;
```

Called from `src/index.ts` right after the logger is created (line 97
today), it attaches both listeners. Each listener:

1. Builds an `Error` instance (rejections may carry non-Error reasons
   like a string or an object; we normalise to `Error` so pino's
   serialiser captures the stack).
2. Calls `logger.fatal({ err }, "<message>")`. Pino's redact config
   in `src/core/logger.ts` already censors `password`, `token`,
   `secret`, `apiKey`, `accessToken`, `refreshToken`, `mqttPassword`
   so a stack trace mentioning one of these names is sanitised.
3. Schedules `process.exit(1)` after `FLUSH_DELAY_MS = 200` ms. This
   is the same delay `logHandle.close()` uses for graceful shutdown
   — empirically enough for pino's worker_thread transports
   (pino-pretty in dev, pino-roll in prod) to flush the line to
   stdout and to `data/logs/sowel.N.log`.

The timer is NOT `unref()`d: it must keep the event loop alive long
enough to flush. After exit, Docker's `restart: unless-stopped`
policy reboots the container.

The existing graceful `SIGINT` / `SIGTERM` handlers in `src/index.ts`
(lines 66-71 and 526-527) are unchanged. They operate on a separate
path (cooperative shutdown) and do not collide with the crash
handlers.

## Acceptance criteria

A `setInterval` callback in the core that throws synchronously:

- `data/logs/sowel.N.log` contains a `{"level":"fatal", ..., "msg":"Uncaught exception, exiting", "err":{ ... stack ... }}` entry
- Docker logs (`docker logs sowel`) show the same line
- Container restarts within ~200ms + Docker's restart delay
- The exit code observed by Docker is 1

An async function in the core that rejects without a `catch`:

- Same shape, with `"msg":"Unhandled promise rejection, exiting"`
- The rejection reason is normalised: a string becomes an `Error("the string")`, an Error stays an Error

Bootstrap-window crashes (before logger creation) keep working via
the existing `main().catch()` stderr fallback — no regression.

The pino redact paths still apply: if a stack trace happens to
contain `password=...` inside an object, pino redacts the matching
keys. Bare strings in the stack message are not redacted (pino's
limitation; documented).

## Verification (manual, optional)

A one-off check after merge: temporarily add
`setTimeout(() => { throw new Error("F03 smoke"); }, 5000)` in
`src/index.ts`, boot Sowel, and confirm the fatal entry lands in
`data/logs/sowel.N.log` 5 seconds in, then revert. The unit tests
below cover this without needing the manual hack.
