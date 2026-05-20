import { describe, it, expect } from "vitest";
import { isCumulativeBarChart } from "./history-utils";

describe("isCumulativeBarChart", () => {
  it("routes energy bindings to the bar chart", () => {
    expect(isCumulativeBarChart("energy")).toBe(true);
  });

  it("routes all rain bindings to the bar chart (user preference)", () => {
    // Includes the bare `rain` alias (instantaneous mm/h) — kept as bars even
    // though it is conceptually a rate, on explicit user request.
    expect(isCumulativeBarChart("rain")).toBe(true);
  });

  it("routes other categories to the line chart by default", () => {
    expect(isCumulativeBarChart("temperature")).toBe(false);
    expect(isCumulativeBarChart("humidity")).toBe(false);
    expect(isCumulativeBarChart("pressure")).toBe(false);
    expect(isCumulativeBarChart("wind")).toBe(false);
  });
});
