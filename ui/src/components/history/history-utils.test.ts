import { describe, it, expect } from "vitest";
import { isCumulativeBarChart } from "./history-utils";

describe("isCumulativeBarChart", () => {
  it("routes energy bindings to the bar chart regardless of alias", () => {
    expect(isCumulativeBarChart("energy", "energy")).toBe(true);
    expect(isCumulativeBarChart("energy", "consumption")).toBe(true);
    expect(isCumulativeBarChart("energy", "main_meter")).toBe(true);
  });

  it("routes sum_rain_* aliases to the bar chart (cumulative)", () => {
    expect(isCumulativeBarChart("rain", "sum_rain_1")).toBe(true);
    expect(isCumulativeBarChart("rain", "sum_rain_24")).toBe(true);
  });

  it("routes the bare `rain` alias to the line chart (instantaneous rate)", () => {
    // Regression: this used to be a bar chart because the category check
    // alone treated all "rain" bindings as cumulative. The Netatmo `rain`
    // alias is mm/h, not a cumulative total.
    expect(isCumulativeBarChart("rain", "rain")).toBe(false);
  });

  it("routes other categories to the line chart by default", () => {
    expect(isCumulativeBarChart("temperature", "temperature")).toBe(false);
    expect(isCumulativeBarChart("humidity", "humidity")).toBe(false);
    expect(isCumulativeBarChart("pressure", "pressure")).toBe(false);
    expect(isCumulativeBarChart("wind", "wind_strength")).toBe(false);
  });

  it("is case-insensitive on the sum_rain_ prefix", () => {
    expect(isCumulativeBarChart("rain", "Sum_Rain_24")).toBe(true);
  });
});
