/** 16-point compass abbreviations (FR). 0° = N, clockwise. */
const COMPASS_FR = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO",
];

/** Convert a meteorological wind angle (0 = North, clockwise) to a compass abbreviation. */
export function angleToCompass(angle: number): string {
  const normalized = ((angle % 360) + 360) % 360;
  const idx = Math.round(normalized / 22.5) % 16;
  return COMPASS_FR[idx];
}
