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
 * Range-specific cap on the number of X-axis labels. Picked so the labels read
 * as "one entry per natural time unit" — 7 labels on 7d, 10 on 30d, etc.
 */
const RANGE_MAX_LABELS: Record<TimeRange, number> = {
  "6h": 6,
  "24h": 8,
  "7d": 7,
  "30d": 10,
};

/**
 * Compute the Recharts `interval` value (= number of ticks to skip between two visible ticks).
 *
 * Aims for ≤ `maxLabels` visible ticks given (a) the time range and (b) the
 * available viewport width. The smaller of the two caps wins so mobile stays
 * legible even on short ranges.
 */
export function pickTickInterval(count: number, viewportWidth: number, range?: TimeRange): number {
  const viewportMax = viewportWidth < 360 ? 6 : viewportWidth < 640 ? 8 : 12;
  const rangeMax = range ? RANGE_MAX_LABELS[range] : viewportMax;
  const maxLabels = Math.min(rangeMax, viewportMax);
  if (count <= maxLabels) return 0;
  // Ceil so the visible tick count actually stays ≤ maxLabels.
  // floor() would underestimate the skip and let too many labels through
  // (e.g. count=19 / maxLabels=12 → floor 1 → interval 0 → all 19 shown).
  return Math.ceil(count / maxLabels) - 1;
}
