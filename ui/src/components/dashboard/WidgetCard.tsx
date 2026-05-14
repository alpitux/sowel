import type { ReactNode } from "react";

interface WidgetCardProps {
  label: string;
  /** Optional className extension — used by callers that need to layer behavior (cursor, transitions, edit-mode chrome…). */
  className?: string;
  /** Optional click handler — when set, the caller is expected to apply a cursor-pointer class via `className`. */
  onClick?: () => void;
  children: ReactNode;
}

/**
 * Shared dashboard widget shell.
 *
 * Three responsibilities:
 * - Visual chrome (bg, border, radius, padding, fixed responsive height).
 * - Centered title at 17 px, truncated.
 * - Vertical flex container for the widget's per-type content.
 *
 * Per-type widgets (light, shutter, thermostat, etc.) wrap their content
 * with this component. See specs/098-design-system-dashboard.
 */
export function WidgetCard({
  label,
  className = "",
  onClick,
  children,
}: WidgetCardProps) {
  return (
    <div
      className={`bg-surface border border-border rounded-md p-3 flex flex-col h-[160px] sm:h-[240px] overflow-hidden ${className}`}
      onClick={onClick}
    >
      <span className="text-[17px] font-semibold text-text truncate mb-2 text-center">
        {label}
      </span>
      {children}
    </div>
  );
}
