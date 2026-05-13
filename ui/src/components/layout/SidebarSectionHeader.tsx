import type { MouseEvent, ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";

interface SidebarSectionHeaderProps {
  /** Primary route the header links to. If omitted, renders as a non-link <button>. */
  to?: string;
  label: string;
  icon: ReactNode;
  /** When true, an active state is forced (e.g. ADMIN_ROUTES matcher). */
  active?: boolean;
  /** When defined, renders an expand chevron. */
  expanded?: boolean;
  collapsed?: boolean;
  /** Trailing element shown next to (or in place of) the chevron. */
  badge?: ReactNode;
  /** Forwarded to NavLink — disables prefix matching. */
  end?: boolean;
  title?: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void;
}

function headerClasses(isActive: boolean, collapsed: boolean): string {
  const base =
    "flex items-center gap-2 px-3 py-1.5 w-full rounded-[6px] transition-colors duration-150 ease-out";
  const layout = collapsed ? "justify-center" : "";
  const state = isActive
    ? "bg-primary-light"
    : "hover:bg-background";
  return `${base} ${layout} ${state}`.trim();
}

function labelClasses(isActive: boolean): string {
  const base = "text-[11px] font-semibold uppercase tracking-wider transition-colors";
  return `${base} ${isActive ? "text-primary" : "text-text-secondary"}`;
}

function iconColorClass(isActive: boolean): string {
  return isActive ? "text-primary" : "text-text-secondary";
}

interface ContentProps {
  isActive: boolean;
  collapsed: boolean;
  label: string;
  icon: ReactNode;
  expanded?: boolean;
  badge?: ReactNode;
}

function HeaderContent({ isActive, collapsed, label, icon, expanded, badge }: ContentProps) {
  return (
    <>
      <span className={`flex-shrink-0 relative ${iconColorClass(isActive)}`}>
        {icon}
      </span>
      {!collapsed && (
        <span className={labelClasses(isActive)}>{label}</span>
      )}
      {!collapsed && (badge !== undefined || expanded !== undefined) && (
        <span className="ml-auto flex items-center gap-1 flex-shrink-0">
          {badge}
          {expanded !== undefined && (
            expanded ? (
              <ChevronDown size={12} strokeWidth={1.5} className="text-text-tertiary" />
            ) : (
              <ChevronRight size={12} strokeWidth={1.5} className="text-text-tertiary" />
            )
          )}
        </span>
      )}
    </>
  );
}

export function SidebarSectionHeader({
  to,
  label,
  icon,
  active,
  expanded,
  collapsed = false,
  badge,
  end,
  title,
  onClick,
}: SidebarSectionHeaderProps) {
  if (to) {
    return (
      <NavLink
        to={to}
        end={end}
        onClick={onClick}
        title={title}
        className={({ isActive: navIsActive }) =>
          headerClasses(active ?? navIsActive, collapsed)
        }
      >
        {({ isActive: navIsActive }) => (
          <HeaderContent
            isActive={active ?? navIsActive}
            collapsed={collapsed}
            label={label}
            icon={icon}
            expanded={expanded}
            badge={badge}
          />
        )}
      </NavLink>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`${headerClasses(active ?? false, collapsed)} cursor-pointer`}
    >
      <HeaderContent
        isActive={active ?? false}
        collapsed={collapsed}
        label={label}
        icon={icon}
        expanded={expanded}
        badge={badge}
      />
    </button>
  );
}
