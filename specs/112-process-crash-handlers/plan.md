# Spec 112 — Implementation plan

Single feature branch `feat/process-crash-handlers`. Estimated effort:
**0.5 day** (1.5h code + 1.5h tests + 1h doc + validation). No DB
migration, no UI, no schema change, no breaking change.

## Tasks

### Phase 1 — Implementation (1.5 hours)

1. [ ] Create `src/core/process-crash-handlers.ts` with the shape in
       `architecture.md`: `FLUSH_DELAY_MS` constant +
       `installProcessCrashHandlers(logger)` function.
2. [ ] Add the import in `src/index.ts` and call
       `installProcessCrashHandlers(logger)` right after line 97
       (after `const logger = logHandle.logger;`).

### Phase 2 — Tests (1.5 hours)

3. [ ] Create `src/core/process-crash-handlers.test.ts`. Use
       `vi.useFakeTimers()`, `vi.spyOn(process, "exit")`, and a mock
       logger. Save/restore `process.listeners("uncaughtException")`
       and `process.listeners("unhandledRejection")` around each
       test to avoid global leakage.
4. [ ] Run `npx vitest run src/core/process-crash-handlers.test.ts`,
       all six scenarios green.

### Phase 3 — Documentation (1 hour)

5. [ ] Add a v1.11.1 entry to `docs/release-notes.md` under the
       existing `## 1.11.x — Plugin soft isolation` group, with the
       mandatory `### v1.11.1 — 2026-05-19 { #v1-11-1 }` anchor for
       the spec 108 CI check. Two short bullets: process crash
       handlers added; explain the benefit for post-incident
       debugging.
6. [ ] Same in `docs/release-notes.fr.md`.
7. [ ] Add a row for spec 112 in `docs/specs-index.md` § V1.11
       and `docs/specs-index.fr.md` § V1.11.
8. [ ] Mark acceptance criteria as `[x]` in
       `specs/112-process-crash-handlers/spec.md` and tasks as `[x]`
       in this file.

### Phase 4 — Validate (15 min)

9. [ ] `npx tsc --noEmit` clean (backend).
10. [ ] `npx eslint src/ --ext .ts` clean (zero errors).
11. [ ] `npx vitest run` green (606 + 6 new = 612 cases expected).
12. [ ] `cd ui && npx tsc -b --noEmit` clean (no UI change but
        sanity check).

### Phase 5 — Ship (15 min)

13. [ ] Commit on branch `feat/process-crash-handlers`. Conventional
        message `feat(core): add process crash handlers (spec 112)`.
14. [ ] Push, open PR via `gh pr create`. Body lists the test plan
        and links to the spec.
15. [ ] Wait for explicit merge approval from the user.
16. [ ] After merge: `git checkout main && git pull`, then
        `scripts/release.sh 1.11.1` (patch release, no flag change,
        no schema change).
17. [ ] Watch the GitHub Actions release workflow, verify the new
        Docker image lands on `ghcr.io/mchacher/sowel:1.11.1` and
        `:latest`.

## Test plan

A single test file `src/core/process-crash-handlers.test.ts` exercises
all behaviour through fake timers and a mock logger. No real
`process.exit` ever fires (spied) and the global process listeners
are snapshotted around each test.

### Test scenarios

| #   | Scenario                                                                  | Expected                                                                                  |
| --- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | `uncaughtException` with an `Error`                                       | `logger.fatal` called once with `{ err }` matching the thrown error and a string message  |
| 2   | `uncaughtException` schedules `process.exit(1)` after `FLUSH_DELAY_MS`    | `exit` NOT called before 200ms, called with `1` exactly at 200ms                          |
| 3   | `unhandledRejection` with an `Error`                                      | `logger.fatal` called with the Error preserved; second arg message mentions "rejection"   |
| 4   | `unhandledRejection` with a non-Error reason (string)                     | `logger.fatal` called with `{ err: Error("<string>") }`; the wrapping preserves the value |
| 5   | `unhandledRejection` with a non-Error reason (number)                     | `logger.fatal` called with `{ err: Error("<stringified>") }`; no throw inside the handler |
| 6   | Reinstalling `installProcessCrashHandlers` removes the previous listeners | After two calls, `process.listenerCount("uncaughtException") === 1` (not 2)               |

### Logger assertion pattern

```ts
function makeMockLogger() {
  const fatal = vi.fn();
  const self = { fatal, child: () => self };
  return self as unknown as Logger;
}

function expectFatal(logger: MockLogger, expected: Record<string, unknown>) {
  expect(logger.fatal).toHaveBeenCalledWith(expect.objectContaining(expected), expect.any(String));
}
```

Same shape as the spec 111 helpers — we test the pino call signature
`(context, message)` and assert on the context object, not the
message string.

### What is not tested

- The actual flush of pino transports to `data/logs/sowel.N.log`.
  That depends on pino-roll's worker_thread, which is integration
  territory and would slow the test suite for marginal gain.
- The real `process.exit(1)`. Spied; the spy verification covers
  that we asked for code `1`.
- The interplay with SIGINT/SIGTERM handlers. They run on different
  events and are out of this spec's scope.

## Rollback strategy

Revert the commit. There is no state to restore: the new module is
additive, the call site in `src/index.ts` is one line, no schema
change, no event type, no config. Reverting brings the codebase to
the pre-spec-112 state.

If only one part needs to be disabled in an emergency, comment out
the call site in `src/index.ts` and redeploy. The module file can
stay; it is inert without the call.
