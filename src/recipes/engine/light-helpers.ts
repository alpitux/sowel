// ============================================================
// Shared light helpers (used by Motion Light, Switch Light, etc.)
// ============================================================

import { findDataByCategory, findOrderByCategory } from "../../equipments/binding-resolver.js";
import type { RecipeContext } from "./recipe.js";

/**
 * Check if any light in the list is currently ON.
 */
export function isAnyLightOn(lightIds: string[], ctx: RecipeContext): boolean {
  for (const lightId of lightIds) {
    const bindings = ctx.equipmentManager.getDataBindingsWithValues(lightId);
    const stateBinding = findDataByCategory(bindings, ["light_state"], ["state"]);
    if (
      stateBinding &&
      (stateBinding.value === true || String(stateBinding.value).toUpperCase() === "ON")
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Resolve the toggle order binding for a light. Category-first
 * (`light_toggle`/`toggle_power`) so manually-rebound lights (alias = device
 * key) keep working. Returns `undefined` when the equipment has no compatible
 * binding so callers can skip the dispatch silently.
 */
function resolveToggleOrder(lightId: string, ctx: RecipeContext) {
  const equipment = ctx.equipmentManager.getByIdWithDetails(lightId);
  if (!equipment) return undefined;
  return findOrderByCategory(equipment.orderBindings, ["light_toggle", "toggle_power"], ["state"]);
}

/**
 * Resolve the actual ON or OFF value from the order binding's enumValues.
 * Falls back to uppercase "ON"/"OFF" (Z2M convention) if no enum match found.
 */
function resolveEnumValue(
  stateOrder: { enumValues?: string[] } | undefined,
  target: "on" | "off",
): string {
  const match = stateOrder?.enumValues?.find((v) => v.toLowerCase() === target);
  return match ?? target.toUpperCase();
}

/**
 * Turn on all lights via their toggle order binding.
 * Returns an array of error messages (empty if all succeeded).
 */
export function turnOnLights(lightIds: string[], ctx: RecipeContext): string[] {
  const errors: string[] = [];
  for (const lightId of lightIds) {
    const order = resolveToggleOrder(lightId, ctx);
    if (!order) continue;
    try {
      ctx.dispatchOrder(lightId, order.alias, resolveEnumValue(order, "on")).catch(() => {});
    } catch (err) {
      errors.push(`${lightId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return errors;
}

/**
 * Turn off all lights via their toggle order binding.
 * Returns an array of error messages (empty if all succeeded).
 */
export function turnOffLights(lightIds: string[], ctx: RecipeContext): string[] {
  const errors: string[] = [];
  for (const lightId of lightIds) {
    const order = resolveToggleOrder(lightId, ctx);
    if (!order) continue;
    try {
      ctx.dispatchOrder(lightId, order.alias, resolveEnumValue(order, "off")).catch(() => {});
    } catch (err) {
      errors.push(`${lightId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return errors;
}

/**
 * Set brightness on all lights that have a brightness order binding.
 * Silently skips lights without brightness capability (light_onoff).
 * Returns an array of error messages (empty if all succeeded).
 */
export function setLightsBrightness(
  lightIds: string[],
  ctx: RecipeContext,
  brightness: number,
): string[] {
  const errors: string[] = [];
  for (const lightId of lightIds) {
    const equipment = ctx.equipmentManager.getByIdWithDetails(lightId);
    if (!equipment) continue;
    const brightnessOrder = findOrderByCategory(
      equipment.orderBindings,
      ["set_brightness"],
      ["brightness"],
    );
    if (!brightnessOrder) continue;
    try {
      ctx.dispatchOrder(lightId, brightnessOrder.alias, brightness).catch(() => {});
    } catch (err) {
      errors.push(`${lightId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return errors;
}
