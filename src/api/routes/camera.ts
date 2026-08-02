import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Readable } from "node:stream";
import type { EquipmentManager } from "../../equipments/equipment-manager.js";
import type { Logger } from "../../core/logger.js";
import type { DataCategory } from "../../shared/types.js";

interface CameraDeps {
  equipmentManager: EquipmentManager;
  logger: Logger;
}

const FETCH_TIMEOUT_MS = 10_000;
const HLS_CONTENT_TYPES = new Set(["application/vnd.apple.mpegurl", "application/x-mpegurl"]);

/**
 * Media-proxy routes for the `camera` equipment type (spec 133).
 *
 * The bound `camera_snapshot_url` / `camera_stream_url` device data already
 * holds a plugin-resolved URL (local or vendor-relay) — this route simply
 * fetches it server-side and streams the bytes to the authenticated UI
 * client. The browser never learns the camera's real URL, credentials, or
 * LAN address (spec 111 plugin isolation extends naturally here since no
 * plugin code runs in this path at all).
 *
 * Both routes are binding-gated: a category not bound on the equipment is
 * unreachable here even if the underlying device supports it — this is the
 * per-camera admin opt-in from spec 133, enforced server-side, not just
 * hidden in the UI.
 */
export function registerCameraRoutes(app: FastifyInstance, deps: CameraDeps): void {
  const { equipmentManager, logger } = deps;
  const log = logger.child({ module: "camera-proxy" });

  app.get<{ Params: { id: string } }>(
    "/api/v1/equipments/:id/camera/snapshot",
    async (request, reply) =>
      proxyCameraMedia(request, reply, request.params.id, "camera_snapshot_url"),
  );

  app.get<{ Params: { id: string } }>(
    "/api/v1/equipments/:id/camera/stream",
    async (request, reply) =>
      proxyCameraMedia(request, reply, request.params.id, "camera_stream_url"),
  );

  // Sub-resource proxy for HLS segments/child playlists referenced by a
  // rewritten manifest (see rewriteHlsManifest below). `u` must resolve to
  // the same origin as the camera's current camera_stream_url value — this
  // keeps the route from being usable as an open proxy by a caller who
  // already has an authenticated session.
  app.get<{ Params: { id: string }; Querystring: { u?: string } }>(
    "/api/v1/equipments/:id/camera/stream/segment",
    async (request, reply) => {
      const equipmentId = request.params.id;
      const target = request.query.u;
      if (!target) {
        return reply.code(400).send({ error: "u is required" });
      }

      const gated = resolveCameraBinding(equipmentId, "camera_stream_url");
      if ("error" in gated) return reply.code(gated.status).send({ error: gated.error });

      let targetUrl: URL;
      let streamUrl: URL;
      try {
        targetUrl = new URL(target);
        streamUrl = new URL(gated.value);
      } catch {
        return reply.code(400).send({ error: "Invalid URL" });
      }
      if (targetUrl.origin !== streamUrl.origin) {
        return reply.code(403).send({ error: "Segment URL origin mismatch" });
      }

      return fetchAndPipe(request, reply, targetUrl.toString(), log, equipmentId);
    },
  );

  function resolveCameraBinding(
    equipmentId: string,
    category: DataCategory,
  ): { value: string } | { status: number; error: string } {
    const equipment = equipmentManager.getByIdWithDetails(equipmentId);
    if (!equipment) return { status: 404, error: "Equipment not found" };
    if (equipment.type !== "camera") return { status: 400, error: "Not a camera equipment" };

    const binding = equipment.dataBindings.find((b) => b.category === category);
    if (!binding) {
      return { status: 404, error: `${category} is not bound on this equipment` };
    }
    if (typeof binding.value !== "string" || binding.value.length === 0) {
      return { status: 409, error: "Camera has no current media URL" };
    }
    if (equipment.status === "offline") {
      return { status: 409, error: "Camera is offline" };
    }
    return { value: binding.value };
  }

  async function proxyCameraMedia(
    request: FastifyRequest,
    reply: FastifyReply,
    equipmentId: string,
    category: DataCategory,
  ) {
    const gated = resolveCameraBinding(equipmentId, category);
    if ("error" in gated) return reply.code(gated.status).send({ error: gated.error });

    return fetchAndPipe(request, reply, gated.value, log, equipmentId, {
      rewriteHls: category === "camera_stream_url",
      equipmentId,
    });
  }
}

async function fetchAndPipe(
  request: FastifyRequest,
  reply: FastifyReply,
  url: string,
  log: Logger,
  equipmentId: string,
  opts?: { rewriteHls?: boolean; equipmentId?: string },
) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return reply.code(502).send({ error: "Camera media URL is invalid" });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return reply.code(502).send({ error: "Camera media URL scheme is not supported" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const onClose = () => controller.abort();
  request.raw.on("close", onClose);

  try {
    const upstream = await fetch(parsed, { signal: controller.signal });
    if (!upstream.ok || !upstream.body) {
      return reply.code(502).send({ error: `Upstream returned ${upstream.status}` });
    }

    const contentType = upstream.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    reply.header("cache-control", "no-store");

    if (opts?.rewriteHls && HLS_CONTENT_TYPES.has(contentType)) {
      const manifest = await upstream.text();
      const rewritten = rewriteHlsManifest(manifest, parsed, opts.equipmentId!);
      reply.header("content-type", contentType);
      return reply.send(rewritten);
    }

    reply.header("content-type", contentType || "application/octet-stream");
    return reply.send(
      Readable.fromWeb(upstream.body as unknown as import("node:stream/web").ReadableStream),
    );
  } catch (err) {
    log.warn({ err, equipmentId, url: parsed.origin }, "Camera media proxy fetch failed");
    return reply.code(502).send({ error: "Failed to fetch camera media" });
  } finally {
    clearTimeout(timeout);
    request.raw.off("close", onClose);
  }
}

/**
 * Rewrite every URI line of an HLS manifest (segments or child playlists) to
 * go through the /camera/stream/segment sub-resource proxy, so the browser
 * never talks to the camera's real host directly.
 *
 * Known limitation: a master playlist referencing variant playlists that
 * themselves need rewriting is only rewritten one level deep — each
 * proxied child playlist is re-fetched raw by the browser via the segment
 * route without further rewriting. Revisit once tested against a real
 * camera in the sowel-plugin-netatmo-camera spec.
 */
function rewriteHlsManifest(manifest: string, manifestUrl: URL, equipmentId: string): string {
  const base = `/api/v1/equipments/${equipmentId}/camera/stream/segment`;
  return manifest
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed === "" || trimmed.startsWith("#")) return line;
      let absolute: string;
      try {
        absolute = new URL(trimmed, manifestUrl).toString();
      } catch {
        return line;
      }
      return `${base}?u=${encodeURIComponent(absolute)}`;
    })
    .join("\n");
}
