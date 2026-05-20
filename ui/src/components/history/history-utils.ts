export type TimeRange = "6h" | "24h" | "7d" | "30d";

/**
 * Decide whether a binding should be visualised as a bar chart.
 *
 * `rain` and `energy` are rendered as bars (cumulative or rate-style values
 * that read better as discrete buckets); every other category is a line.
 *
 * Kept as a helper (rather than a Set) so we can refine the rule per alias
 * later without changing the call site.
 */
export function isCumulativeBarChart(category: string): boolean {
  return category === "rain" || category === "energy";
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
