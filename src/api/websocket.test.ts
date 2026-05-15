import { describe, it, expect } from "vitest";
import { extractWsToken, isWsOriginAllowed } from "./websocket.js";

describe("websocket auth helpers", () => {
  describe("extractWsToken", () => {
    it("returns the bearer token from the Authorization header", () => {
      expect(extractWsToken("Bearer abc.def.ghi", undefined)).toBe("abc.def.ghi");
    });

    it("returns null on missing or malformed Authorization header", () => {
      expect(extractWsToken(undefined, undefined)).toBeNull();
      expect(extractWsToken("", undefined)).toBeNull();
      expect(extractWsToken("Basic dXNlcjpwYXNz", undefined)).toBeNull();
    });

    it("returns the token from a single `bearer.<token>` subprotocol", () => {
      expect(extractWsToken(undefined, "bearer.swl_123abc")).toBe("swl_123abc");
    });

    it("preserves dots inside JWT tokens (splits only on first `bearer.` prefix)", () => {
      const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.signature";
      expect(extractWsToken(undefined, `bearer.${jwt}`)).toBe(jwt);
    });

    it("finds the bearer protocol among other comma-separated subprotocols", () => {
      expect(extractWsToken(undefined, "echo, bearer.swl_x, chat")).toBe("swl_x");
    });

    it("handles array-form subprotocol header", () => {
      expect(extractWsToken(undefined, ["echo", "bearer.swl_y"])).toBe("swl_y");
    });

    it("prefers the Authorization header over the subprotocol", () => {
      expect(extractWsToken("Bearer from-header", "bearer.from-subprotocol")).toBe("from-header");
    });

    it("returns null when no bearer protocol is present", () => {
      expect(extractWsToken(undefined, "echo, chat")).toBeNull();
      expect(extractWsToken(undefined, "")).toBeNull();
    });

    it("returns null on `bearer.` with empty token", () => {
      expect(extractWsToken(undefined, "bearer.")).toBeNull();
    });
  });

  describe("isWsOriginAllowed", () => {
    const corsOrigins = ["http://localhost:3000", "https://sowel.exemple.com"];

    it("allows requests with no Origin header (non-browser clients)", () => {
      expect(isWsOriginAllowed(undefined, corsOrigins)).toBe(true);
    });

    it("allows whitelisted origins", () => {
      expect(isWsOriginAllowed("http://localhost:3000", corsOrigins)).toBe(true);
      expect(isWsOriginAllowed("https://sowel.exemple.com", corsOrigins)).toBe(true);
    });

    it("refuses unknown origins", () => {
      expect(isWsOriginAllowed("https://evil.tld", corsOrigins)).toBe(false);
      expect(isWsOriginAllowed("http://localhost:9999", corsOrigins)).toBe(false);
    });

    it("allows everything when wildcard is in the list (user explicit opt-in)", () => {
      expect(isWsOriginAllowed("https://anything.tld", ["*"])).toBe(true);
      expect(isWsOriginAllowed("http://localhost:3000", ["*", "http://localhost:3000"])).toBe(true);
    });

    it("handles array-form origin header by checking the first value", () => {
      expect(isWsOriginAllowed(["http://localhost:3000", "spoofed"], corsOrigins)).toBe(true);
      expect(isWsOriginAllowed(["https://evil.tld"], corsOrigins)).toBe(false);
    });
  });
});
