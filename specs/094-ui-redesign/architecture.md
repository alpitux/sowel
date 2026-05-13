# Architecture — Spec 094 — UI Redesign (Phase 0 palette swap)

## Overview

Phase 0 is a single CSS migration. No JSX touched, no React changes, no backend changes. The goal is to make every `text-primary`, `bg-surface`, `border-border-light` already present in production resolve to the refined design-system palette.

## Current state

```
ui/src/index.css
├── @import "tailwindcss";
├── @theme { ... }              ← Tailwind v4 tokens (current Warm palette)
│   ├── --color-primary: #1A4F6E
│   ├── --color-accent:  #D4963F
│   └── ...                     ← hard-coded hex values
└── .dark { ... }               ← dark mode override (current Warm dark)

ui/src/theme.ts
└── setDarkClass()              ← toggles .dark class on <html>
```

## Target state

```
ui/src/index.css
├── @import "tailwindcss";
├── @import "../../design-system/tokens.css";     ← NEW: source of truth
├── @theme { ... }              ← alias layer (no more hard-coded hex)
│   ├── --color-primary: var(--p-500)
│   ├── --color-accent:  var(--a-500)
│   └── ...
└── (dark overrides removed — now inside tokens.css)

design-system/tokens.css
├── :root, [data-theme="hybrid"] { ...light palette... }
└── [data-theme="dark"], .dark  { ...dark palette... }   ← extended selector

ui/src/theme.ts                  ← unchanged
```

## File changes

### `ui/src/index.css`

1. Add the import line near the top, after `@import "tailwindcss";`.
2. Replace every literal hex value inside `@theme { ... }` with the matching `var(--*)` from `tokens.css`.
3. Remove the manual `.dark { ... }` block — dark values are now supplied by `tokens.css` via the extended selector.

The full mapping table is documented in [design-system/migration.md](../../design-system/migration.md) §5.

### `design-system/tokens.css`

Extend the dark-mode selector so the existing `.dark` class toggling (handled by [ui/src/theme.ts](../../ui/src/theme.ts)) keeps working without modification:

```css
/* before */
[data-theme="dark"] { ... }

/* after */
[data-theme="dark"], .dark { ... }
```

This is the only change to `tokens.css`. All token values remain the originals from the design system.

### `ui/src/theme.ts`

**Not modified.** The `.dark` class toggling logic is preserved. The `light | dark | system` setting and `prefers-color-scheme` listener continue to work.

## Rollback

Single `git revert` of the commit. The change is two-file (`ui/src/index.css` + `design-system/tokens.css`) and self-contained — no migrations, no DB changes, no state.

## Risk assessment

| Risk                                                           | Likelihood | Mitigation                                                                                                |
| -------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------- |
| Tailwind v4 doesn't accept `var(--*)` inside `@theme`          | Very low   | Documented Tailwind v4 behavior — `@theme` accepts arbitrary CSS values incl. `var()`. Verified at build. |
| A literal hex in JSX (`#1A4F6E`) escapes the swap              | Medium     | Grep before merge: `grep -rEn '#[0-9A-Fa-f]{3,6}' ui/src/**/*.tsx` — review each hit                      |
| Dark mode visually broken because selector extension misorders | Low        | Side-by-side dark screenshots are an acceptance criterion                                                 |
| Some component reads CSS variables via JS (uncommon)           | Very low   | Grep: `getComputedStyle.*--color-`. Patch on a case-by-case basis if found                                |
| Existing Storybook / visual tests break                        | Low        | None today — no Storybook, no Chromatic                                                                   |

## Subsequent phases (out of scope for this spec)

Each becomes its own light spec in 095-102. They are intentionally NOT detailed here — the full breakdown lives in [design-system/migration.md](../../design-system/migration.md) and individual sub-specs.

## References

- [design-system/migration.md](../../design-system/migration.md) — Full migration plan
- [design-system/tokens.css](../../design-system/tokens.css) — Token source of truth
- [ui/src/index.css](../../ui/src/index.css) — Current `@theme` block
- [ui/src/theme.ts](../../ui/src/theme.ts) — Theme switching (unchanged)
