import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Network } from "lucide-react";
import { useActivity } from "../../store/useActivity";
import { useWebSocket } from "../../store/useWebSocket";
import { useZones } from "../../store/useZones";
import type { ActivityItem, ZoneWithChildren } from "../../types";
import { ActivityItemRow } from "./ActivityItemRow";

interface Props {
  zoneId: string;
}

export function ActivityPanel({ zoneId }: Props) {
  const { t } = useTranslation();
  const items = useActivity((s) => s.items);
  const status = useActivity((s) => s.status);
  const loadForZone = useActivity((s) => s.loadForZone);
  const reset = useActivity((s) => s.reset);
  const includeDescendants = useActivity((s) => s.includeDescendants);
  const setIncludeDescendants = useActivity((s) => s.setIncludeDescendants);
  const tree = useZones((s) => s.tree);
  const wsStatus = useWebSocket((s) => s.status);
  const isLive = wsStatus === "connected";

  // Compute descendant zone IDs for the current zone (excluding the zone itself).
  // Updated whenever the tree or zoneId changes; passed to the store on load + toggle.
  const descendantIds = useMemo(() => collectDescendantIds(tree, zoneId), [tree, zoneId]);
  const hasDescendants = descendantIds.length > 0;

  // Re-render every minute so relative-time labels stay fresh.
  // One global timer per ActivityPanel instance, not per item.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Load on zone change. Reset prevents leakage between zones.
  useEffect(() => {
    if (!zoneId) return;
    reset();
    void loadForZone(zoneId, descendantIds);
  }, [zoneId, loadForZone, reset, descendantIds]);

  const groups = useMemo(() => groupByHour(items, new Date()), [items]);

  return (
    <section className="bg-surface border border-border-light rounded-lg overflow-hidden">
      {/* Panel head — strict alignment with design-system .panel__head */}
      <div className="flex items-center gap-[0.55rem] px-[1.1rem] py-[0.55rem] min-h-[44px] bg-primary-light border-b border-[var(--p-100)]">
        <h2 className="text-[0.72rem] font-bold text-primary uppercase tracking-[0.12em]">
          {t("activity.title")}
        </h2>
        <span className="text-[0.72rem] text-primary/65 font-medium normal-case tracking-normal">
          {t("activity.subtitle")}
        </span>
        {hasDescendants && (
          <button
            type="button"
            onClick={() => void setIncludeDescendants(!includeDescendants, descendantIds)}
            title={
              includeDescendants
                ? t("activity.toggleDescendants.on")
                : t("activity.toggleDescendants.off")
            }
            aria-pressed={includeDescendants}
            className={
              includeDescendants
                ? "ml-auto inline-flex items-center justify-center w-[22px] h-[22px] rounded-[4px] bg-primary text-[var(--n-0)] hover:bg-primary-hover transition-colors"
                : "ml-auto inline-flex items-center justify-center w-[22px] h-[22px] rounded-[4px] bg-transparent text-primary border border-[var(--p-100)] hover:bg-surface transition-colors"
            }
          >
            <Network size={12} strokeWidth={2} />
          </button>
        )}
        <span
          className={
            (hasDescendants ? "ml-[0.4rem] " : "ml-auto ") +
            (isLive
              ? "font-mono text-[0.68rem] font-semibold leading-none px-[7px] py-[1px] rounded-full bg-[var(--green-50)] text-[var(--green-700)] border border-[var(--green-50)]"
              : "font-mono text-[0.68rem] font-semibold leading-none px-[7px] py-[1px] rounded-full bg-background text-text-tertiary border border-border-light")
          }
        >
          {isLive ? `● ${t("activity.live")}` : `○ ${t("activity.offline")}`}
        </span>
      </div>

      {/* Body */}
      <div className="py-[0.35rem]">
        {status === "loading" && items.length === 0 && (
          <div className="px-[1.1rem] py-3 text-[0.78rem] text-text-tertiary">
            {t("activity.loading")}
          </div>
        )}
        {status === "error" && items.length === 0 && (
          <div className="px-[1.1rem] py-3 text-[0.78rem] text-error">
            {t("activity.loadError")}
          </div>
        )}
        {status === "ready" && items.length === 0 && (
          <div className="px-[1.1rem] py-3 text-[0.78rem] text-text-tertiary">
            {t("activity.empty")}
          </div>
        )}
        {groups.map((group) => (
          <div key={group.key}>
            <div className="px-[1.1rem] py-[0.35rem] font-mono text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-text-tertiary border-t border-border-light first:border-t-0">
              {group.label}
            </div>
            {group.items.map((item) => (
              <ActivityItemRow key={item.id} item={item} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

interface Group {
  key: string;
  label: string;
  items: ActivityItem[];
}

function groupByHour(items: ActivityItem[], now: Date): Group[] {
  const groups: Group[] = [];
  const groupMap = new Map<string, Group>();

  const currentHourBucket = bucketKey(now.getTime());

  for (const item of items) {
    const key = bucketKey(item.timestamp);
    let group = groupMap.get(key);
    if (!group) {
      const label = key === currentHourBucket ? `${formatHour(item.timestamp)} → maintenant` : formatHour(item.timestamp);
      group = { key, label, items: [] };
      groupMap.set(key, group);
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

function bucketKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
}

function formatHour(timestamp: number): string {
  const d = new Date(timestamp);
  return `${pad(d.getHours())}:00`;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function collectDescendantIds(tree: ZoneWithChildren[], zoneId: string): string[] {
  const found = findZone(tree, zoneId);
  if (!found) return [];
  const out: string[] = [];
  const walk = (z: ZoneWithChildren) => {
    for (const child of z.children ?? []) {
      out.push(child.id);
      walk(child);
    }
  };
  walk(found);
  return out;
}

function findZone(tree: ZoneWithChildren[], zoneId: string): ZoneWithChildren | null {
  for (const z of tree) {
    if (z.id === zoneId) return z;
    const child = findZone(z.children ?? [], zoneId);
    if (child) return child;
  }
  return null;
}
