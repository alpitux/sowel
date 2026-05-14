# Architecture — Spec 095 — Typography Polish

## Overview

Four independent edits, all surface-level:

| Bundle | Surface                                    | Files                  | Mechanical?            |
| ------ | ------------------------------------------ | ---------------------- | ---------------------- |
| A      | 87 `uppercase tracking-wider` replacements | ~25 files              | Yes (sed-style sweep)  |
| B      | 17 H1 class chain unifications             | ~17 files (1 per page) | Yes (per-file edit)    |
| C      | 5-15 selective bumps on body text          | ~5-10 files            | No (judgment per case) |
| D      | 1 CSS rule                                 | `ui/src/index.css`     | Yes                    |

No backend, no state, no API, no migrations.

## Bundle A — sweep

The exact replacement, applied by Edit tool with `replace_all: true` scoped per file:

```
old: uppercase tracking-wider
new: uppercase tracking-widest
```

This catches the 87 paired occurrences. The 4 unpaired `tracking-wider` (without `uppercase`) — all in `ZoneRecipesSection.tsx` — are unaffected because the literal string doesn't match.

Tailwind v4 maps `tracking-widest` to `letter-spacing: 0.1em` by default. Close enough to the design system's `0.12em–0.14em` target.

## Bundle B — H1 canonical chain

Define a single H1 class chain:

```html
<h1
  className="text-[18px] sm:text-[24px] font-semibold text-text leading-[24px] sm:leading-[32px]"
></h1>
```

For 17 page H1s, the audit identified these variants:

| Page                     | Current                                   | Action                                        |
| ------------------------ | ----------------------------------------- | --------------------------------------------- |
| `LogsPage.tsx`           | `text-[24px] ... leading-[32px]`          | Add `sm:` for responsive (or 18 px on mobile) |
| `PluginsPage.tsx`        | `text-[20px] sm:text-[24px] ...`          | Mobile 20 → 18 (small adjustment)             |
| `MqttPublishersPage.tsx` | `text-[24px] ... leading-[32px]`          | Same as Logs                                  |
| `ModesPage.tsx`          | already matches canonical                 | No change                                     |
| `ModeDetailPage.tsx`     | already matches canonical (with truncate) | No change (`truncate` preserved)              |
| (12 other H1s)           | varies — read in place                    | Align to canonical                            |

For any H1 with additional utilities (`truncate`, `flex`, etc.), those are preserved — only size/weight/leading classes are unified.

## Bundle C — selective mobile bump

Strategy: I'll grep for `text-[10px]` and `text-[11px]` and read each in context. Bump to `text-[12px]` only when:

- The element is a body text span (not a chip or badge)
- The size is the default (not a responsive override)
- The element appears on mobile (not desktop-only hover/tooltip)

Likely candidates from a preliminary scan:

- Form field hints / help text
- Inline error messages
- Empty-state subtitles

I'll document each fix in the PR description for review.

## Bundle D — global CSS rule

Add to [ui/src/index.css](../../ui/src/index.css) after the `@theme` block:

```css
/* Tabular nums by default for monospace containers — keeps digits
   at the same width when values change (no layout jitter). */
.font-mono {
  font-feature-settings: "tnum" 1;
}
```

Existing `tabular-nums` utility usage is idempotent (same `font-feature-settings: "tnum" 1`). Lines using `font-mono tabular-nums` together work the same as before.

## Risk assessment

| Risk                                                          | Likelihood | Mitigation                                                                                        |
| ------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------- |
| Bundle A — letter-spacing widens, label wraps to a 2nd line   | Low        | Sidebar labels are short (≤ 12 chars), adding 2-3 px width is within slack. Verify visually.      |
| Bundle B — H1 size change on mobile feels too small           | Low        | 18 px on mobile is comfortable. If user dislikes, revert per page.                                |
| Bundle C — bumping a chip text breaks chip layout             | Medium     | Strict scope: body text only, not chips. Audit list in PR for user to approve before merging.     |
| Bundle D — non-numeric mono content loses cv11/ss01 ligatures | Very low   | Mono content is rarely Inter; ligatures don't apply meaningfully. No visible regression expected. |
| Combined: a single user-visible change cascades               | Low        | Each bundle is independent; per-bundle git commits could split if needed.                         |

## File changes (estimated)

| Area                 | File count                          |
| -------------------- | ----------------------------------- |
| Bundle A (sweep)     | ~25 files in `ui/src/components/**` |
| Bundle B (H1)        | ~17 files in `ui/src/pages/**`      |
| Bundle C (selective) | ~5-10 files (TBD in audit)          |
| Bundle D (CSS)       | 1 file: `ui/src/index.css`          |

## Rollback

`git revert` of the commit. All changes are class-name replacements in JSX + one CSS rule — fully reversible.

## References

- [design-system/tokens.md](../../design-system/tokens.md) §2.2, §2.3
- [Tailwind tracking utilities](https://tailwindcss.com/docs/letter-spacing)
- [ui/src/index.css](../../ui/src/index.css) — current state
