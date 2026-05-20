export type TimeRange = "6h" | "24h" | "7d" | "30d";

/**
 * Decide whether a binding should be visualised as a cumulative bar chart.
 *
 * `category` alone is not sufficient for rain: Netatmo exposes three rain
 * bindings sharing the `rain` category but with different semantics:
 *   - `rain` (instant rate, mm/h) → must be a line chart.
 *   - `sum_rain_1` (cumulative over 1 h) → bar.
 *   - `sum_rain_24` (cumulative over 24 h) → bar.
 *
 * For the `energy` category all aliases are cumulative (Wh/kWh), so the
 * category check is enough there.
 */
export function isCumulativeBarChart(category: string, alias: string): boolean {
  if (category === "energy") return true;
  if (category === "rain") return /^sum_rain/i.test(alias);
  return false;
}

/** Convert a TimeRange to a relative "from" string for the API. */
export function rangeToFrom(range: TimeRange): string {
  switch (range) {
    case "6h":
      return "-6h";
    case "24h":
      return "-24h";
    case "7d":
      return "-168h"; // 7 * 24
    case "30d":
      return "-720h"; // 30 * 24
  }
}

/** Convert a TimeRange to its duration in milliseconds. */
export function rangeToDurationMs(range: TimeRange): number {
  switch (range) {
    case "6h":
      return 6 * 60 * 60 * 1000;
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "7d":
      return 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return 30 * 24 * 60 * 60 * 1000;
  }
}
