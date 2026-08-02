import { describe, it, expect, afterEach, vi } from "vitest";
import Fastify from "fastify";
import { createLogger } from "../../core/logger.js";
import { registerCameraRoutes } from "./camera.js";
import type { EquipmentWithDetails } from "../../shared/types.js";

type PartialEquipment = Partial<EquipmentWithDetails> & { id: string };

function makeManager(byId: Record<string, PartialEquipment | undefined>) {
  return {
    getByIdWithDetails: (id: string) => byId[id] ?? null,
  } as unknown as Parameters<typeof registerCameraRoutes>[1]["equipmentManager"];
}

function cameraFixture(overrides: Partial<PartialEquipment> = {}): PartialEquipment {
  return {
    id: "cam1",
    type: "camera",
    status: "online",
    dataBindings: [
      {
        id: "b1",
        equipmentId: "cam1",
        deviceDataId: "dd1",
        alias: "snapshot",
        deviceId: "d1",
        deviceName: "Front door camera",
        key: "snapshot_url",
        type: "text",
        category: "camera_snapshot_url",
        value: "https://camera.example.invalid/snapshot.jpg",
        lastUpdated: new Date().toISOString(),
        lastChanged: new Date().toISOString(),
        stale: false,
      } as unknown as EquipmentWithDetails["dataBindings"][number],
    ],
    orderBindings: [],
    ...overrides,
  };
}

describe("GET /api/v1/equipments/:id/camera/snapshot — binding-gated media proxy", () => {
  let app: ReturnType<typeof Fastify>;

  afterEach(async () => {
    await app.close();
    vi.unstubAllGlobals();
  });

  it("404s when the equipment does not exist", async () => {
    app = Fastify({ logger: false });
    registerCameraRoutes(app, {
      equipmentManager: makeManager({}),
      logger: createLogger("silent").logger,
    });
    await app.ready();

    const res = await app.inject({ method: "GET", url: "/api/v1/equipments/nope/camera/snapshot" });
    expect(res.statusCode).toBe(404);
  });

  it("400s when the equipment is not a camera", async () => {
    app = Fastify({ logger: false });
    registerCameraRoutes(app, {
      equipmentManager: makeManager({
        cam1: cameraFixture({ type: "sensor" }),
      }),
      logger: createLogger("silent").logger,
    });
    await app.ready();

    const res = await app.inject({ method: "GET", url: "/api/v1/equipments/cam1/camera/snapshot" });
    expect(res.statusCode).toBe(400);
  });

  it("404s when camera_snapshot_url is not bound — even though the goal is a live camera, an admin who never bound the category must get the same 'no such thing here' response as any other unbound category, not a special-cased error", async () => {
    app = Fastify({ logger: false });
    registerCameraRoutes(app, {
      equipmentManager: makeManager({
        cam1: cameraFixture({ dataBindings: [] }),
      }),
      logger: createLogger("silent").logger,
    });
    await app.ready();

    const res = await app.inject({ method: "GET", url: "/api/v1/equipments/cam1/camera/snapshot" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toMatch(/camera_snapshot_url/);
  });

  it("409s when bound but the camera is offline", async () => {
    app = Fastify({ logger: false });
    registerCameraRoutes(app, {
      equipmentManager: makeManager({
        cam1: cameraFixture({ status: "offline" }),
      }),
      logger: createLogger("silent").logger,
    });
    await app.ready();

    const res = await app.inject({ method: "GET", url: "/api/v1/equipments/cam1/camera/snapshot" });
    expect(res.statusCode).toBe(409);
  });

  it("proxies the upstream bytes and content-type on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(new Blob([new Uint8Array([1, 2, 3])]), {
            status: 200,
            headers: { "content-type": "image/jpeg" },
          }),
      ),
    );

    app = Fastify({ logger: false });
    registerCameraRoutes(app, {
      equipmentManager: makeManager({ cam1: cameraFixture() }),
      logger: createLogger("silent").logger,
    });
    await app.ready();

    const res = await app.inject({ method: "GET", url: "/api/v1/equipments/cam1/camera/snapshot" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("image/jpeg");
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(Buffer.from(res.rawPayload).equals(Buffer.from([1, 2, 3]))).toBe(true);
  });

  it("502s when the upstream fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network unreachable");
      }),
    );

    app = Fastify({ logger: false });
    registerCameraRoutes(app, {
      equipmentManager: makeManager({ cam1: cameraFixture() }),
      logger: createLogger("silent").logger,
    });
    await app.ready();

    const res = await app.inject({ method: "GET", url: "/api/v1/equipments/cam1/camera/snapshot" });
    expect(res.statusCode).toBe(502);
  });

  it("502s when the upstream returns a non-2xx status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 404 })),
    );

    app = Fastify({ logger: false });
    registerCameraRoutes(app, {
      equipmentManager: makeManager({ cam1: cameraFixture() }),
      logger: createLogger("silent").logger,
    });
    await app.ready();

    const res = await app.inject({ method: "GET", url: "/api/v1/equipments/cam1/camera/snapshot" });
    expect(res.statusCode).toBe(502);
  });
});

describe("GET /api/v1/equipments/:id/camera/stream — binding gate mirrors snapshot", () => {
  let app: ReturnType<typeof Fastify>;

  afterEach(async () => {
    await app.close();
    vi.unstubAllGlobals();
  });

  it("404s when camera_stream_url is not bound, independent of camera_snapshot_url", async () => {
    app = Fastify({ logger: false });
    registerCameraRoutes(app, {
      // Snapshot is bound, stream is not — this is exactly the "admin
      // opted into snapshot but not live view" case spec 133 requires.
      equipmentManager: makeManager({ cam1: cameraFixture() }),
      logger: createLogger("silent").logger,
    });
    await app.ready();

    const res = await app.inject({ method: "GET", url: "/api/v1/equipments/cam1/camera/stream" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toMatch(/camera_stream_url/);
  });

  it("rewrites an HLS manifest to route segments through the segment proxy", async () => {
    const manifest = [
      "#EXTM3U",
      "#EXT-X-VERSION:3",
      "#EXTINF:2.0,",
      "segment1.ts",
      "#EXTINF:2.0,",
      "segment2.ts",
    ].join("\n");

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(manifest, {
            status: 200,
            headers: { "content-type": "application/vnd.apple.mpegurl" },
          }),
      ),
    );

    app = Fastify({ logger: false });
    registerCameraRoutes(app, {
      equipmentManager: makeManager({
        cam1: cameraFixture({
          dataBindings: [
            {
              id: "b2",
              equipmentId: "cam1",
              deviceDataId: "dd2",
              alias: "stream",
              deviceId: "d1",
              deviceName: "Front door camera",
              key: "stream_url",
              type: "text",
              category: "camera_stream_url",
              value: "https://camera.example.invalid/live/index.m3u8",
              lastUpdated: new Date().toISOString(),
              lastChanged: new Date().toISOString(),
              stale: false,
            } as unknown as EquipmentWithDetails["dataBindings"][number],
          ],
        }),
      }),
      logger: createLogger("silent").logger,
    });
    await app.ready();

    const res = await app.inject({ method: "GET", url: "/api/v1/equipments/cam1/camera/stream" });
    expect(res.statusCode).toBe(200);
    const body = res.body;
    expect(body).toContain("#EXTM3U");
    expect(body).toContain(
      "/api/v1/equipments/cam1/camera/stream/segment?u=" +
        encodeURIComponent("https://camera.example.invalid/live/segment1.ts"),
    );
    expect(body.split("\n")).not.toContain("segment1.ts");
  });
});

describe("GET /api/v1/equipments/:id/camera/stream/segment — origin allowlist", () => {
  let app: ReturnType<typeof Fastify>;

  afterEach(async () => {
    await app.close();
    vi.unstubAllGlobals();
  });

  const streamBoundFixture = cameraFixture({
    dataBindings: [
      {
        id: "b2",
        equipmentId: "cam1",
        deviceDataId: "dd2",
        alias: "stream",
        deviceId: "d1",
        deviceName: "Front door camera",
        key: "stream_url",
        type: "text",
        category: "camera_stream_url",
        value: "https://camera.example.invalid/live/index.m3u8",
        lastUpdated: new Date().toISOString(),
        lastChanged: new Date().toISOString(),
        stale: false,
      } as unknown as EquipmentWithDetails["dataBindings"][number],
    ],
  });

  it("403s when the requested segment URL is on a different origin than the camera's stream URL", async () => {
    app = Fastify({ logger: false });
    registerCameraRoutes(app, {
      equipmentManager: makeManager({ cam1: streamBoundFixture }),
      logger: createLogger("silent").logger,
    });
    await app.ready();

    const res = await app.inject({
      method: "GET",
      url:
        "/api/v1/equipments/cam1/camera/stream/segment?u=" +
        encodeURIComponent("https://attacker.example.invalid/steal"),
    });
    expect(res.statusCode).toBe(403);
  });

  it("proxies the segment when the origin matches", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(new Blob([new Uint8Array([9, 9])]), {
            status: 200,
            headers: { "content-type": "video/mp2t" },
          }),
      ),
    );

    app = Fastify({ logger: false });
    registerCameraRoutes(app, {
      equipmentManager: makeManager({ cam1: streamBoundFixture }),
      logger: createLogger("silent").logger,
    });
    await app.ready();

    const res = await app.inject({
      method: "GET",
      url:
        "/api/v1/equipments/cam1/camera/stream/segment?u=" +
        encodeURIComponent("https://camera.example.invalid/live/segment1.ts"),
    });
    expect(res.statusCode).toBe(200);
  });
});
