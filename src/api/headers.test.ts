import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import helmet from "@fastify/helmet";

// Replicates the helmet + HSTS configuration in server.ts. If server.ts diverges,
// this test no longer protects against regressions — keep them in sync.
async function buildAppWithHelmet(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        mediaSrc: ["'self'", "blob:"],
        connectSrc: ["'self'", "ws:", "wss:"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        manifestSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        "upgrade-insecure-requests": null,
      },
    },
    strictTransportSecurity: false,
    frameguard: { action: "deny" },
    referrerPolicy: { policy: "no-referrer" },
    noSniff: true,
  });

  app.addHook("onSend", (req, reply, payload, done) => {
    const xfProto = req.headers["x-forwarded-proto"];
    const proto =
      (Array.isArray(xfProto) ? xfProto[0] : xfProto) ??
      ((req.socket as { encrypted?: boolean }).encrypted ? "https" : "http");
    if (proto === "https") {
      reply.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    done(null, payload);
  });

  app.get("/health", async () => ({ status: "ok" }));
  await app.ready();
  return app;
}

describe("Security headers", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildAppWithHelmet();
  });

  afterEach(async () => {
    await app.close();
  });

  it("sets Content-Security-Policy with expected directives", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    const csp = res.headers["content-security-policy"];
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it("allows Google Fonts in CSP (Nunito heading font loaded from CDN)", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    const csp = res.headers["content-security-policy"] as string;
    expect(csp).toMatch(/style-src[^;]*https:\/\/fonts\.googleapis\.com/);
    expect(csp).toMatch(/font-src[^;]*https:\/\/fonts\.gstatic\.com/);
  });

  // Spec 133 — camera snapshots are fetched as a Blob (the media-proxy
  // route needs an Authorization header a plain <img src> can't carry)
  // and rendered via URL.createObjectURL(blob). Without "blob:" here that
  // <img> is silently blocked — no console error, it just never paints.
  // Confirmed live (2026-08-04) against a real Netatmo camera: this exact
  // regression happened, traced via "open image in new tab" (bypasses
  // page CSP) rendering fine while the inline <img> stayed blank.
  it("allows blob: in img-src for camera snapshot rendering (spec 133)", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    const csp = res.headers["content-security-policy"] as string;
    expect(csp).toMatch(/img-src[^;]*\bblob:/);
  });

  // Same bug class as img-src above, one layer up: hls.js/MediaSource
  // assigns a blob: URL to the <video> element itself. Without an
  // explicit media-src this fell back to default-src (no blob:), and
  // Chrome enforces that fallback strictly while Firefox doesn't — live
  // view worked in Firefox and failed silently, instantly, with zero
  // network requests in Chrome (desktop and Android alike). Confirmed
  // live 2026-08-04.
  it("allows blob: in media-src for camera live view rendering (spec 133)", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    const csp = res.headers["content-security-policy"] as string;
    expect(csp).toMatch(/media-src[^;]*\bblob:/);
  });

  it("allows data: URIs in font-src (Inter font is inlined by Vite as data: woff2)", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    const csp = res.headers["content-security-policy"] as string;
    expect(csp).toMatch(/font-src[^;]*\bdata:/);
  });

  it("does NOT include upgrade-insecure-requests (would break LAN HTTP deployments)", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    const csp = res.headers["content-security-policy"] as string;
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("allows WebSocket connections in CSP (connect-src includes ws: and wss:)", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    const csp = res.headers["content-security-policy"] as string;
    expect(csp).toMatch(/connect-src[^;]*\bws:/);
    expect(csp).toMatch(/connect-src[^;]*\bwss:/);
  });

  it("sets X-Frame-Options to DENY (clickjacking protection)", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.headers["x-frame-options"]).toBe("DENY");
  });

  it("sets Referrer-Policy to no-referrer", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
  });

  it("sets X-Content-Type-Options to nosniff", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("does NOT set HSTS over plain HTTP (no proxy header, no TLS socket)", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.headers["strict-transport-security"]).toBeUndefined();
  });

  it("sets HSTS when x-forwarded-proto: https is present", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: { "x-forwarded-proto": "https" },
    });
    expect(res.headers["strict-transport-security"]).toBe("max-age=31536000; includeSubDomains");
  });

  it("does NOT set HSTS when x-forwarded-proto: http is present", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: { "x-forwarded-proto": "http" },
    });
    expect(res.headers["strict-transport-security"]).toBeUndefined();
  });
});
