# Spec 112 — Architecture

One small module plus a single call site in `src/index.ts`. No
schema migration, no event types, no API, no UI.

## Files touched

| File                                      | Change                                                                                                                  |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `src/core/process-crash-handlers.ts`      | **New**. Exports `installProcessCrashHandlers(logger)` and the `FLUSH_DELAY_MS` constant                                |
| `src/core/process-crash-handlers.test.ts` | **New**. Vitest unit tests for both listeners                                                                           |
| [src/index.ts](src/index.ts)              | Add `installProcessCrashHandlers(logger)` call after the logger is created (line 97)                                    |
| `docs/release-notes.md` + `.fr.md`        | New v1.11.1 entry under the existing `## 1.11.x` group, with the mandatory `{ #v1-11-1 }` anchor for the spec 108 check |
| `docs/specs-index.md` + `.fr.md`          | New row for spec 112 in the `V1.11` table                                                                               |

## Module

```ts
// src/core/process-crash-handlers.ts

import type { Logger } from "./logger.js";

/**
 * Milliseconds granted to pino transports to flush the fatal log
 * line before the process exits. Matches the same delay used by
 * `LoggerHandle.close()` in `logger.ts`.
 */
export const FLUSH_DELAY_MS = 200;

/**
 * Spec 112. Install process-wide listeners that turn any uncaught
 * exception or unhandled promise rejection into a structured fatal
 * log line, then exit(1) after a brief flush window so Docker's
 * restart policy reboots the container with a clean state.
 *
 * Idempotent: re-calling this function removes any previously
 * installed listeners from this module (defensive — in practice it
 * is called once from `src/index.ts`).
 */
export function installProcessCrashHandlers(logger: Logger): void {
  const log = logger.child({ module: "process" });

  const onUncaughtException = (err: Error): void => {
    log.fatal({ err }, "Uncaught exception, exiting");
    setTimeout(() => process.exit(1), FLUSH_DELAY_MS);
  };

  const onUnhandledRejection = (reason: unknown): void => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    log.fatal({ err }, "Unhandled promise rejection, exiting");
    setTimeout(() => process.exit(1), FLUSH_DELAY_MS);
  };

  // Defensive cleanup if re-installed (e.g. in tests).
  process.removeAllListeners("uncaughtException");
  process.removeAllListeners("unhandledRejection");

  process.on("uncaughtException", onUncaughtException);
  process.on("unhandledRejection", onUnhandledRejection);
}
```

Decisions:

- **Module-level constant** for the flush delay so tests can advance
  fake timers by exactly that value, and so the value is documented
  in one place that aligns with `logger.ts`'s `close()` budget.
- **`child({ module: "process" })`** so the log entry is filterable by
  the same `module` field every other Sowel component uses. Matches
  the codebase convention.
- **`removeAllListeners`** before installing: defensive against
  double-installation in tests or hot-reload scenarios. In production
  `installProcessCrashHandlers` is called once at boot.
- **Timer NOT `unref()`d**: we want the event loop to stay alive for
  `FLUSH_DELAY_MS` so pino's worker_thread transports finish writing.
  Unref would let the process exit earlier if nothing else is keeping
  the loop alive, losing the log line.
- **`Error` normalisation for unhandled rejections**: pino's
  `err` serialiser only extracts `.stack` from real Error instances.
  A `Promise.reject("some string")` would log as `{ err: "some string" }`
  with no stack. We wrap into `new Error(String(reason))` so the stack
  starts at our handler — not ideal, but better than no stack at all.

## Wiring into `src/index.ts`

```ts
// src/index.ts, around line 96-98 (existing logger creation):

const logBuffer = new LogRingBuffer();
const logHandle = createLogger(config.log.level, logBuffer);
const logger = logHandle.logger;

// Spec 112: install crash handlers as soon as the logger is ready.
// Bootstrap throws that happen before this line still land in the
// existing `main().catch()` stderr fallback at the bottom of this file.
installProcessCrashHandlers(logger);
```

The import goes with the others at the top of the file:

```ts
import { installProcessCrashHandlers } from "./core/process-crash-handlers.js";
```

## Interaction with existing handlers

Today `src/index.ts` carries two `SIGINT`/`SIGTERM` blocks:

- Lines 66-71: a minimal early pair that does `process.exit(0)`. This
  is the safety net during the bootstrap window before the logger is
  ready.
- Lines 526-527: the cooperative `shutdown` function attached after
  every module is initialised. Calls `integrationRegistry.stopAll()`,
  closes the DB, flushes pino via `logHandle.close()`, then exits 0.

The new crash handlers operate on `uncaughtException` and
`unhandledRejection` — different events, no overlap with SIGINT/SIGTERM.
Both can coexist.

The existing `main().catch()` block at the bottom of `src/index.ts`
(lines 530-540) handles bootstrap-time errors. It writes a JSON line
to stderr because the logger may not yet exist. With the crash
handlers installed inside `main()`, the bootstrap window before
`installProcessCrashHandlers(logger)` is still covered by
`main().catch()`, and everything after is covered by the new
handlers. No gap, no overlap.

## Tests

`src/core/process-crash-handlers.test.ts` uses Vitest fake timers and
a mock logger to exercise every path without ever calling the real
`process.exit`. Strategy:

1. Capture and snapshot existing `uncaughtException` /
   `unhandledRejection` listeners in `beforeEach`, restore them in
   `afterEach`. Tests must not leak global state.
2. Spy on `process.exit` so a stray test-induced exit never tears
   down the test runner.
3. `vi.useFakeTimers()` so the `setTimeout(..., FLUSH_DELAY_MS)` can
   be advanced deterministically.
4. Emit synthetic events via `process.emit("uncaughtException", err)`
   and `process.emit("unhandledRejection", reason, fakePromise)`.

The five scenarios are listed in `plan.md` § Test plan.

## What this does not protect

Mirrored from spec.md for the implementer's eyes:

- Throws before `installProcessCrashHandlers(logger)` runs (the few
  ms of bootstrap window; covered by `main().catch()` instead).
- Native module crashes that produce a `SIGSEGV` or `SIGBUS`. Those
  kill the process at the OS level, no Node.js handler fires. Docker
  restart still kicks in, but no log.
- `process.exit()` called by some other code path. The crash handlers
  are not bypassed because there is nothing to bypass — exit means
  exit.

The set of vectors covered is large enough (the three real-world
classes listed in `spec.md` § Problem) that even partial coverage
is a strict improvement over the current state.
