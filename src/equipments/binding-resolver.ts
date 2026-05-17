// ============================================================
// Backend binding resolvers (category-first, alias fallback)
//
// Twin of ui/src/components/equipments/bindingUtils.ts.
// Same semantics, same precedence rules — kept in sync by convention.
// Spec 110.
// ============================================================

import type { DataCategory, OrderCategory } from "../shared/types.js";

interface MinimalOrderBinding {
  alias: string;
  category?: OrderCategory;
}
interface MinimalDataBinding {
  alias: string;
  category?: DataCategory;
}

/**
 * Find an order binding by category, with optional alias and regex fallbacks.
 *
 * Resolution order:
 *   1. First binding whose `category` is in `categories`.
 *   2. First binding whose `alias` is in `aliasFallbacks`.
 *   3. First binding whose `alias` matches any of `aliasPatterns`.
 *
 * Returning `undefined` means no compatible binding was found and the
 * caller should treat the action as unavailable.
 */
export function findOrderByCategory<T extends MinimalOrderBinding>(
  bindings: readonly T[],
  categories: readonly OrderCategory[],
  aliasFallbacks?: readonly string[],
  aliasPatterns?: readonly RegExp[],
): T | undefined {
  const byCategory = bindings.find(
    (b) => b.category !== undefined && categories.includes(b.category),
  );
  if (byCategory) return byCategory;
  if (aliasFallbacks && aliasFallbacks.length > 0) {
    const byAlias = bindings.find((b) => aliasFallbacks.includes(b.alias));
    if (byAlias) return byAlias;
  }
  if (aliasPatterns && aliasPatterns.length > 0) {
    return bindings.find((b) => aliasPatterns.some((re) => re.test(b.alias)));
  }
  return undefined;
}

/** Find a data binding by category, with the same fallback semantics. */
export function findDataByCategory<T extends MinimalDataBinding>(
  bindings: readonly T[],
  categories: readonly DataCategory[],
  aliasFallbacks?: readonly string[],
  aliasPatterns?: readonly RegExp[],
): T | undefined {
  const byCategory = bindings.find(
    (b) => b.category !== undefined && categories.includes(b.category),
  );
  if (byCategory) return byCategory;
  if (aliasFallbacks && aliasFallbacks.length > 0) {
    const byAlias = bindings.find((b) => aliasFallbacks.includes(b.alias));
    if (byAlias) return byAlias;
  }
  if (aliasPatterns && aliasPatterns.length > 0) {
    return bindings.find((b) => aliasPatterns.some((re) => re.test(b.alias)));
  }
  return undefined;
}
