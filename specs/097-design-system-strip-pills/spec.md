# Spec 097 — Design System Phase 3: Strip Pills (Zone Aggregation)

> Light scoping spec — part of the [094 UI redesign umbrella](../094-ui-redesign/spec.md). Expanded into full spec when picked up via `/sowel-feature`.

## Problem

`ZoneAggregationPills` displays aggregated zone state (motion, temperature, openings, etc.) as a row of pills. Today they all look alike — no visual grouping, no alert variant. When a sensor triggers an alarm (smoke, leak, open window), it blends with normal state.

## Goal

Refactor [ZoneAggregationPills.tsx](../../ui/src/components/zones/ZoneAggregationPills.tsx) per [design-system/components/strip.md](../../design-system/components/strip.md): group pills into three semantic clusters (lights / openings / climate) with `--line-2` dividers, and add an `--alert` variant with red background + pulsing leading dot for alarm states.

## In scope

- Group pills into 3 clusters with explicit divider.
- Add `--alert` variant (`--red-50` bg, pulsing `--red-500` dot).
- Mobile: keep horizontal scroll behavior — just verify dividers render.

## Out of scope

- Adding new aggregation types (use existing logic).
- Changing pill content / labels.

## Acceptance criteria

- [ ] Three visual clusters with dividers between them
- [ ] Alert pill pulses on smoke/leak/open-door events
- [ ] Mobile horizontal scroll behavior preserved
- [ ] All existing aggregations still display correctly

## References

- [design-system/components/strip.md](../../design-system/components/strip.md)
- [design-system/components/pill.md](../../design-system/components/pill.md)
- [design-system/migration.md](../../design-system/migration.md) Phase 3
