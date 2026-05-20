import type { TimeRange } from "./history-utils";

/**
 * Build the tick label(s) for a given timestamp at a given range.
 * 7d uses two lines (weekday + day) to avoid overlapping; other ranges stay on one line.
 */
export function formatLabel(iso: string, range: TimeRange): { line1: string; line2?: string } {
  const d = new Date(iso);
  if (range === "6h" || range === "24h") {
    return {
      line1: d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
    };
  }
  if (range === "7d") {
    return {
      line1: d.toLocaleDateString("fr-FR", { weekday: "short" }),
      line2: String(d.getDate()).padStart(2, "0"),
    };
  }
  // 30d — compact DD/MM
  return {
    line1: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
  };
}

/**
 * Compute the Recharts `interval` value (= number of ticks to skip between two visible ticks).
 * Aims for ≤ `maxLabels` visible ticks given the available viewport width.
 */
export function pickTickInterval(count: number, viewportWidth: number): number {
  const maxLabels = viewportWidth < 360 ? 6 : viewportWidth < 640 ? 8 : 12;
  if (count <= maxLabels) return 0;
  return Math.max(1, Math.floor(count / maxLabels)) - 1;
}
