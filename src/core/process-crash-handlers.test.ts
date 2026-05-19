import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FLUSH_DELAY_MS, installProcessCrashHandlers } from "./process-crash-handlers.js";
import type { Logger } from "./logger.js";

// Spec 112 — Unit tests for the process crash handlers.
//
// No real `process.exit` ever fires (spied) and the global process
// listeners are snapshotted around each test to avoid leaking state
// into other test files.

interface MockLogger {
  fatal: ReturnType<typeof vi.fn>;
  child: () => MockLogger;
}

function makeMockLogger(): MockLogger {
  const fatal = vi.fn();
  const self: MockLogger = {
    fatal,
    child: () => self,
  };
  return self;
}

function expectFatal(logger: MockLogger, expected: Record<string, unknown>): void {
  expect(logger.fatal).toHaveBeenCalledWith(expect.objectContaining(expected), expect.any(String));
}

describe("installProcessCrashHandlers", () => {
  let logger: MockLogger;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let originalUncaught: NodeJS.UncaughtExceptionListener[];
  let originalUnhandled: NodeJS.UnhandledRejectionListener[];

  beforeEach(() => {
    logger = makeMockLogger();
    exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    vi.useFakeTimers();

    // Snapshot existing listeners so this test never leaks into
    // others (vitest workers share the same process).
    originalUncaught = process.listeners("uncaughtException") as NodeJS.UncaughtExceptionListener[];
    originalUnhandled = process.listeners(
      "unhandledRejection",
    ) as NodeJS.UnhandledRejectionListener[];
  });

  afterEach(() => {
    process.removeAllListeners("uncaughtException");
    process.removeAllListeners("unhandledRejection");
    for (const l of originalUncaught) process.on("uncaughtException", l);
    for (const l of originalUnhandled) process.on("unhandledRejection", l);
    vi.useRealTimers();
    exitSpy.mockRestore();
  });

  it("logs fatal with the Error on uncaughtException", () => {
    installProcessCrashHandlers(logger as unknown as Logger);
    const err = new Error("boom");
    process.emit("uncaughtException", err);
    expectFatal(logger, { err });
    expect(logger.fatal).toHaveBeenCalledWith(
      expect.objectContaining({ err }),
      expect.stringMatching(/uncaught/i),
    );
  });

  it("delays process.exit(1) by FLUSH_DELAY_MS on uncaughtException", () => {
    installProcessCrashHandlers(logger as unknown as Logger);
    process.emit("uncaughtException", new Error("boom"));
    expect(exitSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(FLUSH_DELAY_MS - 1);
    expect(exitSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(exitSpy).toHaveBeenCalledTimes(1);
  });

  it("logs fatal with the Error on unhandledRejection (Error reason)", () => {
    installProcessCrashHandlers(logger as unknown as Logger);
    const err = new Error("rejected");
    process.emit("unhandledRejection", err, Promise.resolve());
    expectFatal(logger, { err });
    expect(logger.fatal).toHaveBeenCalledWith(
      expect.objectContaining({ err }),
      expect.stringMatching(/rejection/i),
    );
  });

  it("wraps a string reason into an Error on unhandledRejection", () => {
    installProcessCrashHandlers(logger as unknown as Logger);
    process.emit("unhandledRejection", "stringy reason", Promise.resolve());

    expect(logger.fatal).toHaveBeenCalledTimes(1);
    const firstCall = logger.fatal.mock.calls[0]!;
    const context = firstCall[0] as { err: unknown };
    expect(context.err).toBeInstanceOf(Error);
    expect((context.err as Error).message).toBe("stringy reason");
  });

  it("wraps a numeric reason into an Error on unhandledRejection", () => {
    installProcessCrashHandlers(logger as unknown as Logger);
    process.emit("unhandledRejection", 42 as unknown as Error, Promise.resolve());

    expect(logger.fatal).toHaveBeenCalledTimes(1);
    const context = logger.fatal.mock.calls[0]![0] as { err: unknown };
    expect(context.err).toBeInstanceOf(Error);
    expect((context.err as Error).message).toBe("42");
  });

  it("removes previously installed listeners when called twice", () => {
    installProcessCrashHandlers(logger as unknown as Logger);
    installProcessCrashHandlers(logger as unknown as Logger);
    expect(process.listenerCount("uncaughtException")).toBe(1);
    expect(process.listenerCount("unhandledRejection")).toBe(1);
  });
});
