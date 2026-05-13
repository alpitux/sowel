# Spec 095 — Design System Phase 1: Typography & Tabular Nums

> Light scoping spec — part of the [094 UI redesign umbrella](../094-ui-redesign/spec.md). Expanded into full spec when picked up via `/sowel-feature`.

## Problem

Production UI mixes `text-[13px]`, `text-[12px]`, `text-sm`, and other arbitrary sizes. Numeric containers (temperatures, energy values, timestamps) don't use tabular nums consistently — digits jitter when values change. Inter contextual ligatures (`cv11`, `ss01`) are not enabled, so the modern Inter look documented in the design system is absent.

## Goal

Apply the typography rules from [design-system/tokens.md](../../design-system/tokens.md) §2 globally: enable `font-feature-settings: "tnum" 1` on all numeric containers and `cv11, ss01` site-wide. Sweep arbitrary `text-[Npx]` to consistent classes from the documented type scale (§2.2).

## In scope

- Global selector for tabular nums on `font-mono` + any class on the documented numeric list (energy values, temperatures, timestamps, percent dials).
- Sweep arbitrary `text-[Npx]` to standard Tailwind sizes (`text-xs`, `text-sm`, etc.).
- Letter-spacing tightening on titles, widening on uppercase labels — per tokens.md §2.3.

## Out of scope

- Font swap (Inter stays). Future spec may revisit.
- Component layout changes (deferred to subsequent phases).

## Acceptance criteria

- [ ] No arbitrary `text-[Npx]` remaining in `ui/src/**`
- [ ] Numeric containers don't jitter when value changes by digit count (verify on energy live panel)
- [ ] Devtools confirms `font-feature-settings: "tnum" 1, "cv11" 1, "ss01" 1` on body

## References

- [design-system/tokens.md](../../design-system/tokens.md) §2
- [design-system/migration.md](../../design-system/migration.md) Phase 1
