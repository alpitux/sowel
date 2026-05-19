import type { Logger } from "./logger.js";

// Spec 112 — Process crash safety net.
//
// Catches uncaught exceptions and unhandled promise rejections that
// escape every other guard (plugin Proxy wrapper from spec 111,
// try/catch inside callers, etc.) and turns them into a structured
// fatal log line before letting Docker restart the container.

/**
 * Milliseconds granted to pino's worker_thread transports
 * (pino-pretty in dev, pino-roll in prod) to flush the fatal log
 * line before the process exits. Matches the same window used by
 * `LoggerHandle.close()` in `logger.ts`.
 */
export const FLUSH_DELAY_MS = 200;

/**
 * Install process-wide listeners for `uncaughtException` and
 * `unhandledRejection`. Both log a `fatal` entry with structured
 * context (`err`, sanitised by pino's existing redact paths) and
 * then exit(1) after `FLUSH_DELAY_MS` so Docker's restart policy
 * reboots the container with a clean state.
 *
 * Recovery is not attempted: after an uncaught throw the process
 * state is undefined and continuing would hide subtle bugs.
 *
 * Idempotent: re-calling removes any previously registered listeners
 * on the same events, so installing twice in a test or hot-reload
 * scenario is safe.
 */
export function installProcessCrashHandlers(logger: Logger): void {
  const log = logger.child({ module: "process" });

  const onUncaughtException = (err: Error): void => {
    log.fatal({ err }, "Uncaught exception, exiting");
    setTimeout(() => process.exit(1), FLUSH_DELAY_MS);
  };

  const onUnhandledRejection = (reason: unknown): void => {
    // pino's `err` serialiser only extracts a stack from real Error
    // instances. Normalise non-Error reasons (string, number, plain
    // object) so the log entry still carries something useful.
    const err = reason instanceof Error ? reason : new Error(String(reason));
    log.fatal({ err }, "Unhandled promise rejection, exiting");
    setTimeout(() => process.exit(1), FLUSH_DELAY_MS);
  };

  // Defensive cleanup in case the function is called twice (tests,
  // hot reload). In production it is invoked exactly once at boot.
  process.removeAllListeners("uncaughtException");
  process.removeAllListeners("unhandledRejection");

  process.on("uncaughtException", onUncaughtException);
  process.on("unhandledRejection", onUnhandledRejection);
}
