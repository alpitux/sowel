import { describe, it, expect } from "vitest";
import { formatLabel, pickTickInterval } from "./chart-utils";

describe("pickTickInterval", () => {
  it("returns 0 when count fits the desktop budget (≤12)", () => {
    expect(pickTickInterval(7, 1024)).toBe(0);
    expect(pickTickInterval(12, 1024)).toBe(0);
  });

  it("returns 0 when count fits the small-mobile budget (≤6 at <360px)", () => {
    expect(pickTickInterval(6, 320)).toBe(0);
  });

  it("returns 0 when count fits the medium-mobile budget (≤8 at <640px)", () => {
    expect(pickTickInterval(8, 400)).toBe(0);
  });

  it("skips ticks on desktop when count exceeds 12", () => {
    // 30 points / 12 maxLabels = 2.5 → floor = 2 → interval = 1 (=> 1 visible / 2)
    expect(pickTickInterval(30, 1024)).toBe(1);
  });

  it("skips more aggressively on small mobile", () => {
    // 30 points / 6 maxLabels = 5 → interval = 4 (=> 1 visible / 5)
    expect(pickTickInterval(30, 340)).toBe(4);
  });

  it("handles dense hourly history on desktop", () => {
    // 168 points / 12 = 14 → interval = 13 (=> 1 visible / 14)
    expect(pickTickInterval(168, 1024)).toBe(13);
  });

  it("never returns a negative interval", () => {
    expect(pickTickInterval(1, 320)).toBe(0);
    expect(pickTickInterval(0, 320)).toBe(0);
  });
});

describe("formatLabel", () => {
  // Use an ISO at noon UTC to avoid TZ drift around midnight.
  const iso = "2026-03-09T12:00:00.000Z"; // Monday March 9, 2026

  it("returns HH:MM on a single line for 6h/24h ranges", () => {
    const r1 = formatLabel(iso, "6h");
    const r2 = formatLabel(iso, "24h");
    expect(r1.line2).toBeUndefined();
    expect(r2.line2).toBeUndefined();
    // line1 is locale-dependent — assert shape rather than exact value.
    expect(r1.line1).toMatch(/^\d{1,2}[:h]\d{2}/);
  });

  it("returns weekday + day on two lines for 7d", () => {
    const r = formatLabel(iso, "7d");
    expect(r.line1.toLowerCase()).toMatch(/^lun\.?/);
    expect(r.line2).toBe("09");
  });

  it("pads single-digit days with a leading zero on 7d", () => {
    const r = formatLabel("2026-03-03T12:00:00.000Z", "7d");
    expect(r.line2).toBe("03");
  });

  it("returns compact DD/MM on a single line for 30d", () => {
    const r = formatLabel(iso, "30d");
    expect(r.line1).toBe("09/03");
    expect(r.line2).toBeUndefined();
  });

  it("pads month and day on 30d", () => {
    const r = formatLabel("2026-01-05T12:00:00.000Z", "30d");
    expect(r.line1).toBe("05/01");
  });
});
