# Spec 100 — Design System Phase 6: Comportements Panel

> Light scoping spec — part of the [094 UI redesign umbrella](../094-ui-redesign/spec.md). Expanded into full spec when picked up via `/sowel-feature`.

## Problem

Today, `ZoneModesSection` and `ZoneRecipesSection` are two separate panels stacked in the zone view. They're related — Modes set context for which Recipes apply — but presented as unrelated. The design system models them as one panel ("Comportements") with two sub-category heads.

## Goal

Merge [ZoneModesSection.tsx](../../ui/src/components/zones/ZoneModesSection.tsx) and `ZoneRecipesSection.tsx` into a single `ZoneBehaviorsPanel.tsx` with two `.cat-head` sub-sections (Modes + Recettes) inside one `.panel`.

## In scope

- New `ZoneBehaviorsPanel.tsx` component.
- Two `.cat-head` sub-sections inside one panel.
- Modes section above, Recipes below.
- Each section keeps its existing behavior (edit / activate / toggle).

## Out of scope

- Functional changes to mode activation or recipe toggling.
- Changes to the underlying data model.
- The recipe edit modal (separate spec 102).

## Acceptance criteria

- [ ] Single `.panel` with `Comportements` title
- [ ] Modes and Recettes sub-sections render with `.cat-head`
- [ ] Mode activation still works
- [ ] Recipe toggle still works
- [ ] Visual diff: significant. Functional diff: zero.

## References

- [design-system/components/panel.md](../../design-system/components/panel.md)
- [design-system/components/cat-head.md](../../design-system/components/cat-head.md)
- [design-system/components/mode-row.md](../../design-system/components/mode-row.md)
- [design-system/components/recipe-row.md](../../design-system/components/recipe-row.md)
- [design-system/migration.md](../../design-system/migration.md) Phase 6
