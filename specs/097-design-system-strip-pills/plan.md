# Plan — Spec 097 — Strip Pills

## Implementation steps

1. **Branch**: `git checkout -b feat/design-system-strip-pills`.
2. **Open the polished mock** at lines 421-481 (CSS) and 2521-2565 (HTML) for visual reference. Mobile equivalent: lines 1608-1645 (CSS) and 2879-2916 (HTML).
3. **Refactor `ZoneAggregationPills.tsx`** in this order:
   1. Extend the `StatusItem` type with `variant: "default" | "active" | "calm" | "alert"` and `iconTint?: string` (for category-coloring on default variant).
   2. Split the single `items` array into three: `sensorPills`, `counterPills`, `alertPills`.
   3. Push items to the appropriate cluster with the right variant:
      - Sensors (temp/hum/lux): `variant: "default"`, `iconTint: "text-primary"` (matches mock's `info-500`, which maps to our primary in the existing palette).
      - Motion: `variant: data.motion ? "active" : "calm"` (amber when detected, green when calm).
      - Lights: `variant: data.lightsOn > 0 ? "active" : "default"`.
      - Shutters: `variant: "default"`, `iconTint: "text-text-secondary"` (matches mock's `shutter-500`).
      - Water valves: `variant: "default"`, keep current amber when open (via iconTint).
      - Open doors / windows: `variant: "default"`, keep `text-active-text` (amber, current behavior).
      - Water leak / smoke: `variant: "alert"`.
   4. Extract `<StripPill>` as a local component (kept in the same file) — encapsulates the variant → class mapping.
   5. Render clusters with the right dividers: thin `bg-border-light` between intra-cluster pills, thicker `bg-border` between clusters.
4. **Verify mobile rendering** at viewport 390 × 844: same 3-cluster structure, no sparkline (existing behavior via `historyEnabled` flag), horizontal scroll works.
5. **Validate** (Gate 4): `npx tsc --noEmit` (both), `cd ui && npm run build`, `npx vitest run`, `npx eslint src/ --ext .ts`.
6. **Commit** with conventional message.
7. **Open PR** with a short before/after summary.

## Visual mapping (mock → Tailwind)

| Mock CSS                     | Tailwind class (post-Phase 0)                                                           |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| `--c: var(--info-500)`       | `text-primary` (info-500 is the closest token in the production palette; both are blue) |
| `--c: var(--shutter-500)`    | `text-text-secondary` (neutral grey, matches mock's shutter-500)                        |
| `.strip__pill--active`       | `text-active-text` (amber-dark — already the production color)                          |
| `.strip__pill--calm`         | `text-success` (= `var(--green-500)`)                                                   |
| `.strip__pill--alert`        | `bg-error/10 text-error font-semibold`                                                  |
| `.strip__div` (thin)         | `w-px h-4 bg-border-light mx-1`                                                         |
| `.strip__div--group` (heavy) | `w-px h-5 bg-border mx-2`                                                               |

**No pulse on alert** — user-chosen divergence from the mock's `::before` pulsing dot. The bg-red + bold text is enough urgency for our context.

## Test plan

### Modules touched

- `ui/src/components/home/ZoneAggregationPills.tsx` — JSX refactor + variant logic.

### Why no unit tests

Per CLAUDE.md: "no React tests in this project". This is a JSX rendering refactor — no business logic changes. The existing aggregation data flow (`useZoneAggregation` store) is untouched. The variant selection logic is a pure mapping from data to class names; testing it would only verify "what classes do I apply when X" — a UI concern.

### Manual verification scenarios

| Scenario                                        | Expected                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------- |
| Zone with all 3 clusters populated              | Three groups visible, heavier dividers between them, lighter dividers within |
| Zone with only sensors                          | Single cluster, no group dividers                                            |
| Zone with only alerts                           | Single cluster (alerts), no group dividers                                   |
| Zone with empty `aggregationData`               | Component renders `null` (existing)                                          |
| Motion sensor calm > 5 min                      | Pill green text + green icon, "Calme · X min"                                |
| Motion sensor detected                          | Pill amber text + amber icon, "Détecté"                                      |
| At least one light on                           | Lights pill icon + value in amber                                            |
| All lights off                                  | Lights pill in neutral (existing)                                            |
| Smoke detector triggered                        | Alert pill with `bg-error/10` red bg + red text, no pulse                    |
| Water leak detected                             | Alert pill, same as smoke                                                    |
| Open door + open window simultaneously          | Both pills in the alerts cluster, amber text (not alert variant)             |
| Sparkline enabled (history bucket present)      | Sparkline renders inline next to temp / hum / lux pills (sensors only)       |
| Sparkline disabled (`historyEnabled === false`) | No sparkline on any pill                                                     |
| Resize to mobile (< 640 px)                     | Strip scrolls horizontally; cluster dividers stay visible at positions       |
| Dark mode toggle                                | All variants adapt — green/red/amber tones swap to their dark-theme tokens   |
| Zone tree navigation (different zones)          | Strip re-renders with the right pills for each zone                          |

## Tasks

- [x] Branch `feat/design-system-strip-pills` created
- [x] `StatusItem` extended with `variant`, `iconTint`, `valueTint` fields
- [x] Items split into three cluster arrays
- [x] `<StripPill>` component extracted in-file
- [x] Variant → class mapping implemented (default / active / calm / alert)
- [x] Cluster boundary dividers render with `bg-border` (heavier) vs intra-cluster `bg-border-light`
- [x] Sparklines preserved on sensor pills
- [ ] Mobile viewport tested manually (horizontal scroll) — deferred to PR review
- [ ] Dark mode tested manually — deferred to PR review
- [x] Gate 4 passes (tsc + build + vitest + eslint)
- [ ] Commit on feat branch (no Co-Authored-By)
- [ ] PR opened with diff summary + screenshots
- [ ] User approval before merge
