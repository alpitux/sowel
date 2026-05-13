# Spec 102 — Design System Phase 8: Recipe Edit Modal + Surcharges par mode

> Light scoping spec — part of the [094 UI redesign umbrella](../094-ui-redesign/spec.md). Expanded into full spec when picked up via `/sowel-feature`. **Only phase with backend impact.**

## Problem

Today, editing a recipe expands an inline section inside `ZoneRecipesSection.tsx` — cluttered, easy to lose focus, no clear modal entry/exit. Additionally, there's no way to override recipe parameters per mode (e.g. "in Night mode, lower the dim setpoint to 10%"). Users currently must duplicate the recipe with different slots.

## Goal

Two changes in one spec:

1. **UI**: Replace the inline edit in `ZoneRecipesSection.tsx` with a full modal mounted at app root, per [design-system/components/modal.md](../../design-system/components/modal.md).
2. **Feature**: Add a "Surcharges par mode" section inside the modal, allowing per-mode parameter overrides. Requires backend CRUD on a new `recipe_mode_override` table.

## In scope

- New `RecipeEditModal.tsx` component, mounted at root.
- Database migration: new table `recipe_mode_overrides (recipe_id, mode_id, parameters JSON, ...)`.
- Backend: REST endpoints `GET/PUT/DELETE /recipes/:id/overrides/:modeId`.
- Recipe Engine reads overrides at eval time — current mode's override (if any) takes precedence over default params.
- UI surcharges section: list modes, per-mode parameter form.

## Out of scope

- Bulk edit of overrides across recipes.
- Override versioning / audit trail.
- Schedule-based overrides (only mode-based).

## Acceptance criteria

- [ ] Modal replaces inline edit
- [ ] Surcharges section lists all active modes
- [ ] Per-mode parameters override at runtime
- [ ] Recipe Engine respects current mode override
- [ ] Reverting an override falls back to default params
- [ ] Migration is reversible

## References

- [design-system/components/modal.md](../../design-system/components/modal.md)
- [design-system/migration.md](../../design-system/migration.md) Phase 8
- [docs/technical/recipe-development.md](../../docs/technical/recipe-development.md)
- Recipe Engine: `src/recipes/engine/recipe-manager.ts`
