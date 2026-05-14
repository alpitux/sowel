# Architecture — Spec 098 — Dashboard Widget Chrome

## Overview

UI-only refactor that touches:

1. One CSS line (`ui/src/index.css` `@theme`) — radius alignment.
2. One new React component (`WidgetCard.tsx`) — shared shell.
3. Three existing widget files that consume the new component.
4. One design system doc for consistency.

No backend, no state, no API, no migrations.

## `WidgetCard` component

```tsx
// ui/src/components/dashboard/WidgetCard.tsx
import type { ReactNode } from "react";

interface WidgetCardProps {
  label: string;
  /** Optional className extension — used by callers that need to layer behavior (e.g. is-editing). */
  className?: string;
  /** Optional click handler — when set, the card is interactive. */
  onClick?: () => void;
  children: ReactNode;
}

export function WidgetCard({ label, className = "", onClick, children }: WidgetCardProps) {
  return (
    <div
      className={`bg-surface border border-border rounded-md p-3 flex flex-col h-[160px] sm:h-[240px] overflow-hidden ${className}`}
      onClick={onClick}
    >
      <span className="text-[17px] font-semibold text-text truncate mb-2 text-center">{label}</span>
      {children}
    </div>
  );
}
```

Notes:

- `rounded-md` (not `rounded-[8px]`) — semantic class. After the `@theme` swap, this resolves to 8 px.
- Title is 17 px (production value — kept per user decision).
- Fixed responsive height (`h-[160px] sm:h-[240px]`) — same as production today.
- `onClick` is optional. EquipmentWidget's variant at line 485 needs it; the standard one doesn't.

## `@theme` change in `ui/src/index.css`

Single one-line update:

```css
/* Before */
--radius-md: 10px;

/* After */
--radius-md: 8px;
```

Affected utility: `rounded-md` (4 existing usages in `TariffSettings.tsx`, plus all the new widget usages).

Collateral effect: 4 elements in `TariffSettings.tsx` go from 10 → 8 px corner radius. Acceptable side effect per the user (alignment is the priority).

## File changes

| File                                                    | Change                                                                      |
| ------------------------------------------------------- | --------------------------------------------------------------------------- |
| `ui/src/components/dashboard/WidgetCard.tsx`            | new (~25 lines)                                                             |
| `ui/src/components/dashboard/EquipmentWidget.tsx`       | remove local `WidgetCard`, import from new file, update line 485 inline div |
| `ui/src/components/dashboard/WeatherForecastWidget.tsx` | replace inline chrome with `<WidgetCard label=…>`                           |
| `ui/src/components/dashboard/ZoneWidget.tsx`            | replace inline chrome with `<WidgetCard label=…>`                           |
| `ui/src/index.css`                                      | `--radius-md: 10px` → `8px`                                                 |
| `design-system/components/dashboard-widget.md`          | CSS snippet `border-radius: 10px` → `border-radius: var(--r-md)`            |

## Special case: EquipmentWidget line 485

This is a secondary widget renderer (likely the "compact" or "fallback" variant) that uses a slightly different layout (no centered title, different children structure). I need to read it before refactoring — may or may not fit `WidgetCard` cleanly.

If it doesn't fit:

- Update only the radius (`rounded-[10px]` → `rounded-md`) — keep the rest inline.
- Document the divergence in a code comment.

If it fits:

- Wrap in `WidgetCard` with the appropriate prop overrides.

Decision deferred to implementation when I read line 485 in context.

## `ZoneWidget` and `WeatherForecastWidget` — title compatibility

Both currently render the title themselves with custom styling:

```tsx
// WeatherForecastWidget.tsx:56
<span className="text-[17px] font-semibold text-text truncate mb-2 text-center">{label}</span>
```

Same as the WidgetCard's title — so the substitution is direct (pass `label` as prop, drop the inline span).

Verify in implementation: the children of these widgets don't expect a parent layout that diverges from `flex flex-col`. They shouldn't — the production chrome is identical.

## Risk assessment

| Risk                                                              | Likelihood | Mitigation                                                                     |
| ----------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------ |
| `EquipmentWidget.tsx:485` doesn't fit `WidgetCard` exactly        | Low        | Keep that one's chrome inline if needed; just update radius and document.      |
| `rounded-md` change affects unrelated component (TariffSettings)  | Verified   | Already acknowledged by user — 4 places, all in TariffSettings, tolerable.     |
| Vite build fails on `@theme` update                               | Very low   | Single line edit, low syntax risk.                                             |
| Widget per-type renderers expect specific class names from parent | Very low   | They all read children from props; the wrapper provides chrome only.           |
| Edit-mode chrome (drag/delete/customize) breaks                   | Low        | Edit overlay is rendered by the parent grid, not inside WidgetCard. Untouched. |

## Rollback

`git revert` of the commit. Three files changed (WidgetCard, three widgets, index.css, doc).

## References

- [ui/src/components/dashboard/EquipmentWidget.tsx](../../ui/src/components/dashboard/EquipmentWidget.tsx) lines 88-96 (current local WidgetCard) and 485 (secondary)
- [design-system/components/dashboard-widget.md](../../design-system/components/dashboard-widget.md) — visual reference
- [design-system/tokens.md](../../design-system/tokens.md) §4 — radius tokens
