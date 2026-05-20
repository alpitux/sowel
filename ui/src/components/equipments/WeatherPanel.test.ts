import { describe, it, expect } from "vitest";
import { angleToCompass } from "./weather-utils";

describe("angleToCompass", () => {
  it("maps cardinal directions", () => {
    expect(angleToCompass(0)).toBe("N");
    expect(angleToCompass(90)).toBe("E");
    expect(angleToCompass(180)).toBe("S");
    expect(angleToCompass(270)).toBe("O");
  });

  it("maps inter-cardinal directions", () => {
    expect(angleToCompass(45)).toBe("NE");
    expect(angleToCompass(135)).toBe("SE");
    expect(angleToCompass(225)).toBe("SO");
    expect(angleToCompass(315)).toBe("NO");
  });

  it("normalizes 360° to N", () => {
    expect(angleToCompass(360)).toBe("N");
  });

  it("handles negative angles by normalizing", () => {
    expect(angleToCompass(-90)).toBe("O");
  });

  it("rounds to the nearest 16th of a turn", () => {
    // 22.5° boundary → between N and NNE; rounded to NNE
    expect(angleToCompass(22.5)).toBe("NNE");
    // 11° → still closer to N
    expect(angleToCompass(11)).toBe("N");
    // 12° → closer to NNE
    expect(angleToCompass(12)).toBe("NNE");
  });
});
