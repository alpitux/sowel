# Plan — Spec 095 — Typography Polish

## Implementation steps

1. **Branch**: `git checkout -b feat/design-system-typography`
2. **Bundle D first** (lowest risk): add the `.font-mono` rule to `ui/src/index.css`.
3. **Bundle A** (sweep): for each file containing `uppercase tracking-wider`, run an Edit with `replace_all: true` replacing exactly that substring with `uppercase tracking-widest`. The unpaired `tracking-wider` in `ZoneRecipesSection.tsx` is preserved because the literal doesn't match.
4. **Bundle B** (H1): for each H1 in `ui/src/pages/`, read the line, update size + line-height to the canonical chain. Preserve any utility classes outside the standard set (e.g. `truncate`, layout helpers).
5. **Bundle C** (selective): grep `text-[10px]` and `text-[11px]`. Read each in context. Bump to `text-[12px]` only if body content per the rule. Document each fix in a comment in the PR.
6. **Verify visually** on a few key pages: sidebar, dashboard, zone view, energy live, mobile zone view (390 px).
7. **Validate** (Gate 4): `npx tsc --noEmit` (both), `cd ui && npm run build`, `npx vitest run`, `npx eslint src/ --ext .ts`.
8. **Commit** with conventional message.
9. **Open PR** with: list of Bundle C fixes, screenshot of sidebar with the wider letter-spacing.

## Test plan

### Modules touched

- `ui/src/index.css` — 3 lines new CSS
- ~25 component files (Bundle A sweep)
- ~17 page files (Bundle B H1)
- ~5-10 files (Bundle C selective)

### Why no unit tests

Per CLAUDE.md "no React tests in this project". This spec touches class names and one CSS rule — no business logic, no state, no data transformation. The existing Vitest suite (429 tests) must continue to pass (no logic change).

### Manual verification scenarios

| Scenario                                                             | Expected                                                               |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Navigate to `/` (Dashboard)                                          | H1 visually consistent with other pages at the same viewport           |
| Navigate to `/logs`, `/mqtt-publishers`, `/plugins`                  | H1 sizes match Dashboard / Zone (no more outliers at 24 px on mobile)  |
| Open sidebar, observe DASHBOARD / MAISON / MODES / ANALYSE / ÉNERGIE | Labels visibly more "spaced" (0.1em vs 0.05em previous) — premium feel |
| Open a zone, observe ÉQUIPEMENTS, COMPORTEMENTS panel headers        | Same wider tracking applied                                            |
| Sidebar labels in collapsed mode                                     | Labels hidden — irrelevant (sanity check only)                         |
| Open `/energy/live` and watch a power value change rapidly           | Digits don't jitter (Bundle D ensures tabular)                         |
| Temperature pill in zone view changes 21.4 → 21.0                    | Layout unchanged (already had tabular-nums utility)                    |
| Resize to mobile (390 px) on Logs / MQTT / Plugins pages             | H1 fits comfortably (was 24 px on mobile, now 18 px)                   |
| Resize to mobile on Modes / ModeDetail                               | H1 unchanged (already canonical pattern)                               |
| Bundle C touched components — verify body text legibility on mobile  | Text visibly larger, no layout breakage                                |
| Dark mode toggle                                                     | Typography unchanged across themes                                     |
| Devtools inspect any `.font-mono` element                            | `font-feature-settings: "tnum" 1` in computed styles                   |
| Devtools inspect `<body>`                                            | `font-feature-settings: "cv11" 1, "ss01" 1` in computed styles         |

## Tasks

- [x] Branch `feat/design-system-typography` created
- [x] Bundle D — CSS rule added in `ui/src/index.css`
- [x] Bundle A — 87 `uppercase tracking-wider` swept to `uppercase tracking-widest` across 24 files
- [x] Bundle B — all 17 H1 in `ui/src/pages/` aligned to canonical chain
- [ ] ~~Bundle C~~ — deferred to a dedicated audit spec (too many cases, individual judgment per occurrence needed)
- [x] Manual: sidebar label spacing visibly wider (Playwright screenshot)
- [x] Manual: H1 sizes consistent across pages (mobile + desktop tested)
- [x] Manual: no overflow / wrap regression on Dashboard, Zone view, Logs mobile
- [x] Gate 4 passes (tsc + build + vitest + eslint, 429 tests)
- [ ] Commit on feat branch (no Co-Authored-By)
- [ ] PR opened with screenshots
- [ ] User approval before merge
