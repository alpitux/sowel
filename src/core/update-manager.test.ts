import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { UpdateManager, buildHelperScript } from "./update-manager.js";
import { EventBus } from "./event-bus.js";
import { createLogger } from "./logger.js";
import type { BackupManager } from "../backup/backup-manager.js";

const logger = createLogger("silent").logger;

function makeBackupStub(opts: { exportFails?: boolean } = {}): BackupManager {
  return {
    exportToFile: vi.fn(async (filename: string) => {
      if (opts.exportFails) throw new Error("disk full");
      return { path: `/tmp/${filename}`, size: 1234 };
    }),
    rotateLocalBackups: vi.fn(() => ({ deleted: [] })),
    listLocalBackups: vi.fn(() => []),
  } as unknown as BackupManager;
}

describe("UpdateManager", () => {
  let eventBus: EventBus;
  let backup: BackupManager;
  let manager: UpdateManager;

  beforeEach(() => {
    eventBus = new EventBus(logger);
    backup = makeBackupStub();
    manager = new UpdateManager(eventBus, backup, logger);
  });

  describe("isUpdating", () => {
    it("returns false initially", () => {
      expect(manager.isUpdating()).toBe(false);
    });
  });

  describe("isComposeManaged", () => {
    it("returns false when no context cached", () => {
      // No refresh has been called, cache is undefined → returns false
      expect(manager.isComposeManaged()).toBe(false);
    });
  });

  describe("update — error cases", () => {
    it("throws when Docker socket is not available", async () => {
      // Stub: Docker socket check returns false (it's a real fs check on /var/run/docker.sock)
      // On macOS in CI/local without Docker Desktop running, this is false
      // On Linux with Docker, this might be true — but we have no compose context anyway
      vi.spyOn(manager, "isDockerAvailable").mockReturnValue(false);

      await expect(manager.update("1.0.7")).rejects.toThrow(/Docker socket not available/);
    });

    it("throws when not compose managed", async () => {
      vi.spyOn(manager, "isDockerAvailable").mockReturnValue(true);
      vi.spyOn(manager, "getComposeContext").mockReturnValue(null);

      await expect(manager.update("1.0.7")).rejects.toThrow(/Self-update requires docker compose/);
    });

    it("throws when already updating", async () => {
      vi.spyOn(manager, "isDockerAvailable").mockReturnValue(true);
      vi.spyOn(manager, "getComposeContext").mockReturnValue({
        workingDir: "/opt/sowel",
        projectName: "sowel",
        serviceName: "sowel",
      });
      // Spy on spawnHelper to make it pending forever
      const spawnSpy = vi
        .spyOn(manager as unknown as { spawnHelper: () => Promise<void> }, "spawnHelper")
        .mockImplementation(() => new Promise(() => {}));

      // Trigger first update — won't resolve, but updating flag is set
      void manager.update("1.0.7");
      // Allow microtasks to run so backup exportToFile resolves and updating becomes true
      await new Promise((r) => setImmediate(r));

      expect(manager.isUpdating()).toBe(true);

      await expect(manager.update("1.0.8")).rejects.toThrow(/Update already in progress/);

      spawnSpy.mockRestore();
    });

    it("aborts the update when backup fails", async () => {
      const failingBackup = makeBackupStub({ exportFails: true });
      const failingManager = new UpdateManager(eventBus, failingBackup, logger);
      vi.spyOn(failingManager, "isDockerAvailable").mockReturnValue(true);
      vi.spyOn(failingManager, "getComposeContext").mockReturnValue({
        workingDir: "/opt/sowel",
        projectName: "sowel",
        serviceName: "sowel",
      });

      await expect(failingManager.update("1.0.7")).rejects.toThrow(/Pre-update backup failed/);

      // Should be back to not-updating after the failure
      expect(failingManager.isUpdating()).toBe(false);
    });
  });

  describe("update — success path (mocked spawn)", () => {
    it("creates a backup, rotates, and spawns helper", async () => {
      vi.spyOn(manager, "isDockerAvailable").mockReturnValue(true);
      vi.spyOn(manager, "getComposeContext").mockReturnValue({
        workingDir: "/opt/sowel",
        projectName: "sowel",
        serviceName: "sowel",
      });

      const spawnSpy = vi
        .spyOn(manager as unknown as { spawnHelper: () => Promise<void> }, "spawnHelper")
        .mockResolvedValue();

      const progressEvents: Array<{ step: string; message: string }> = [];
      eventBus.on((event) => {
        if (event.type === "system.update.progress") {
          progressEvents.push({ step: event.step, message: event.message });
        }
      });

      await manager.update("1.0.7");

      // Backup was called with a filename containing the version
      expect(backup.exportToFile).toHaveBeenCalledWith(
        expect.stringMatching(/sowel-backup-pre-v1\.0\.7-/),
      );
      // Rotation was called with 3
      expect(backup.rotateLocalBackups).toHaveBeenCalledWith(3);
      // Helper spawn was called
      expect(spawnSpy).toHaveBeenCalledWith(
        "1.0.7",
        expect.objectContaining({ workingDir: "/opt/sowel", serviceName: "sowel" }),
      );

      // Progress events were emitted in order
      const steps = progressEvents.map((e) => e.step);
      expect(steps).toContain("backup");
      expect(steps).toContain("spawning");
      expect(steps).toContain("spawned");

      // Updating flag stays true (we expect helper to kill us soon)
      expect(manager.isUpdating()).toBe(true);
    });
  });

  describe("restartViaHelper — error cases", () => {
    it("throws when Docker socket is not available", async () => {
      vi.spyOn(manager, "isDockerAvailable").mockReturnValue(false);
      await expect(manager.restartViaHelper()).rejects.toThrow(/Docker socket not available/);
    });

    it("throws when not compose managed", async () => {
      vi.spyOn(manager, "isDockerAvailable").mockReturnValue(true);
      vi.spyOn(manager, "getComposeContext").mockReturnValue(null);
      await expect(manager.restartViaHelper()).rejects.toThrow(/not managed by docker compose/);
    });

    it("throws when an operation is already in progress", async () => {
      vi.spyOn(manager, "isDockerAvailable").mockReturnValue(true);
      vi.spyOn(manager, "getComposeContext").mockReturnValue({
        workingDir: "/opt/sowel",
        projectName: "sowel",
        serviceName: "sowel",
      });
      const runSpy = vi
        .spyOn(
          manager as unknown as { runHelperContainer: () => Promise<void> },
          "runHelperContainer",
        )
        .mockImplementation(() => new Promise(() => {}));

      void manager.restartViaHelper();
      await new Promise((r) => setImmediate(r));
      expect(manager.isUpdating()).toBe(true);

      await expect(manager.restartViaHelper()).rejects.toThrow(/already in progress/);

      runSpy.mockRestore();
    });
  });

  describe("restartViaHelper — success path", () => {
    it("spawns a restart helper via runHelperContainer", async () => {
      vi.spyOn(manager, "isDockerAvailable").mockReturnValue(true);
      vi.spyOn(manager, "getComposeContext").mockReturnValue({
        workingDir: "/opt/sowel",
        projectName: "sowel",
        serviceName: "sowel",
      });

      const runSpy = vi
        .spyOn(
          manager as unknown as { runHelperContainer: (args: unknown) => Promise<void> },
          "runHelperContainer",
        )
        .mockResolvedValue();

      const progressEvents: string[] = [];
      eventBus.on((event) => {
        if (event.type === "system.update.progress") {
          progressEvents.push(event.step);
        }
      });

      await manager.restartViaHelper();

      expect(runSpy).toHaveBeenCalledTimes(1);
      const callArg = runSpy.mock.calls[0][0] as { name: string; cmd: string[] };
      expect(callArg.name).toBe("sowel-restarter");
      const fullCmd = callArg.cmd.join(" ");
      // Critical: --force-recreate must be present. Without it compose sees
      // no diff (image + env unchanged) and never restarts the container,
      // leaving the UI stuck on "Update in progress".
      expect(fullCmd).toContain("docker compose up -d --force-recreate sowel");
      expect(fullCmd).not.toContain("docker compose pull");

      expect(progressEvents).toContain("restart");
      expect(progressEvents).toContain("spawned");

      // Updating flag stays true
      expect(manager.isUpdating()).toBe(true);
    });
  });
});

// ────────────────────────────────────────────────────────────────
// Spec 104 — Self-update resilience: buildHelperScript()
// ────────────────────────────────────────────────────────────────
describe("buildHelperScript (spec 104)", () => {
  const stdOpts = {
    image: "ghcr.io/mchacher/sowel:1.7.0",
    latestTag: "ghcr.io/mchacher/sowel:latest",
    serviceName: "sowel",
    targetVersion: "1.7.0",
    pruneCmd: 'echo "prune"',
  };

  it("includes pull + retag + force-recreate + verify in order", () => {
    const script = buildHelperScript(stdOpts);
    const pullIdx = script.indexOf("docker pull ghcr.io/mchacher/sowel:1.7.0");
    const tagIdx = script.indexOf(
      "docker tag ghcr.io/mchacher/sowel:1.7.0 ghcr.io/mchacher/sowel:latest",
    );
    const recreateIdx = script.indexOf("docker compose up -d --force-recreate sowel");
    const verifyIdx = script.indexOf("TARGET_ID=");
    const failedIdx = script.indexOf("FAILED");
    const doneIdx = script.indexOf("done — Sowel updated to v1.7.0");

    expect(pullIdx).toBeGreaterThanOrEqual(0);
    expect(pullIdx).toBeLessThan(tagIdx);
    expect(tagIdx).toBeLessThan(recreateIdx);
    expect(recreateIdx).toBeLessThan(verifyIdx);
    expect(verifyIdx).toBeLessThan(doneIdx);
    expect(failedIdx).toBeGreaterThanOrEqual(0);
    expect(failedIdx).toBeLessThan(doneIdx);
  });

  it("uses set -e so any step failure aborts the script", () => {
    expect(buildHelperScript(stdOpts)).toMatch(/^set -e/m);
  });

  it("only normalizes compose when an image: line exists", () => {
    const script = buildHelperScript(stdOpts);
    expect(script).toContain('if [ -f "$COMPOSE_FILE" ]');
    expect(script).toContain("image:[[:space:]]*ghcr");
  });

  it("avoids overwriting an existing docker-compose.yml.bak", () => {
    const script = buildHelperScript(stdOpts);
    expect(script).toContain('[ -f "$COMPOSE_FILE.bak" ] || cp "$COMPOSE_FILE"');
  });

  // ── Integration: execute the sed against real compose files ──
  // Confirms the regex actually does what we claim (anchored to the
  // sowel service's image line, idempotent, handles whitespace).
  describe("compose normalization sed (integration)", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = mkdtempSync(resolvePath(tmpdir(), "sowel-spec-104-"));
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    function runScript(composeContent: string): {
      composeAfter: string;
      bakExists: boolean;
      bakContent: string | null;
    } {
      // Write the input compose and run just the normalization snippet of
      // buildHelperScript() in the tmp directory. Sandbox the rest by
      // overriding the docker/sleep commands with no-ops.
      const composePath = resolvePath(tmpDir, "docker-compose.yml");
      writeFileSync(composePath, composeContent);

      const script = buildHelperScript(stdOpts);
      // Extract only the normalization block (between the docker tag
      // line and the recreate line) so we don't need a docker daemon.
      const startMarker = "COMPOSE_FILE=docker-compose.yml";
      const endMarker = `echo "[sowel-updater] recreating`;
      const startIdx = script.indexOf(startMarker);
      const endIdx = script.indexOf(endMarker);
      expect(startIdx).toBeGreaterThanOrEqual(0);
      expect(endIdx).toBeGreaterThan(startIdx);
      const snippet = "set -e\n" + script.slice(startIdx, endIdx);

      execFileSync("sh", ["-c", snippet], { cwd: tmpDir });
      const bakPath = resolvePath(tmpDir, "docker-compose.yml.bak");
      return {
        composeAfter: readFileSync(composePath, "utf-8"),
        bakExists: existsSync(bakPath),
        bakContent: existsSync(bakPath) ? readFileSync(bakPath, "utf-8") : null,
      };
    }

    it("rewrites a pinned image line to :latest and creates .bak", () => {
      const before = `services:
  sowel:
    image: ghcr.io/mchacher/sowel:1.6.1
    container_name: sowel
  influxdb:
    image: influxdb:2.7
`;
      const result = runScript(before);
      expect(result.composeAfter).toContain("image: ghcr.io/mchacher/sowel:latest");
      expect(result.composeAfter).not.toContain("1.6.1");
      // Other services (influxdb) untouched
      expect(result.composeAfter).toContain("image: influxdb:2.7");
      expect(result.bakExists).toBe(true);
      expect(result.bakContent).toContain("1.6.1");
    });

    it("is a no-op when compose already uses :latest", () => {
      const before = `services:
  sowel:
    image: ghcr.io/mchacher/sowel:latest
`;
      const result = runScript(before);
      expect(result.composeAfter).toBe(before);
      expect(result.bakExists).toBe(false);
    });

    it("does not overwrite an existing .bak", () => {
      writeFileSync(resolvePath(tmpDir, "docker-compose.yml.bak"), "PRE-EXISTING BAK");
      const before = `services:
  sowel:
    image: ghcr.io/mchacher/sowel:1.5.0
`;
      const result = runScript(before);
      expect(result.composeAfter).toContain(":latest");
      expect(result.bakContent).toBe("PRE-EXISTING BAK");
    });

    it("handles indentation variations (2 vs 4 spaces)", () => {
      const before = `services:
    sowel:
        image: ghcr.io/mchacher/sowel:1.6.0
`;
      const result = runScript(before);
      expect(result.composeAfter).toContain("image: ghcr.io/mchacher/sowel:latest");
    });
  });
});
