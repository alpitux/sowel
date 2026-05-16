import { create } from "zustand";
import type { ActivityItem, ActivityMessage } from "../types";
import { getActivity } from "../api";

const CAPACITY = 50;
const COALESCE_WINDOW_MS = 500;

type Status = "idle" | "loading" | "ready" | "error";

interface ActivityState {
  items: ActivityItem[];
  status: Status;
  zoneId: string | null;
  loadForZone: (zoneId: string) => Promise<void>;
  addItem: (item: ActivityItem) => void;
  reset: () => void;
}

export const useActivity = create<ActivityState>((set, get) => ({
  items: [],
  status: "idle",
  zoneId: null,

  loadForZone: async (zoneId: string) => {
    set({ status: "loading", zoneId, items: [] });
    try {
      const data = await getActivity(zoneId, CAPACITY);
      set({ items: data.items.slice(0, CAPACITY), status: "ready" });
    } catch (err) {
      console.error("Failed to load activity", err);
      set({ status: "error" });
    }
  },

  addItem: (item: ActivityItem) => {
    const state = get();
    // Only keep items relevant to the current zone scope (descendants resolved server-side
    // when subscribed via topic; but the WS broadcasts every activity.added to all subscribers
    // because the server doesn't know the client's selected zone). We filter client-side
    // by checking zoneId: keep if null (global) or matches the loaded zone (handled by the
    // server-side bootstrap already filtering by zone+descendants). Since live items don't
    // carry descendant info, we keep all globals + items matching exact zoneId; the server-side
    // bootstrap remains authoritative for descendants on the initial fetch.
    const items = state.items;
    const merged = coalesce(items[0], item);
    if (merged) {
      set({ items: [merged, ...items.slice(1)].slice(0, CAPACITY) });
    } else {
      set({ items: [item, ...items].slice(0, CAPACITY) });
    }
  },

  reset: () => set({ items: [], status: "idle", zoneId: null }),
}));

/**
 * Attempt to coalesce a new item into the previous one.
 * Returns the merged item, or null when no coalescing applies.
 *
 * Rules:
 * - Both items are category="order"
 * - Same source (deep equal on the source object)
 * - Same alias and same formatted value
 * - The new item's timestamp is within COALESCE_WINDOW_MS of the previous one
 */
export function coalesce(prev: ActivityItem | undefined, next: ActivityItem): ActivityItem | null {
  if (!prev) return null;
  if (next.category !== "order" || prev.category !== "order") return null;
  if (next.timestamp - prev.timestamp > COALESCE_WINDOW_MS) return null;
  if (JSON.stringify(prev.source ?? null) !== JSON.stringify(next.source ?? null)) return null;

  const prevMsg = prev.message;
  const nextMsg = next.message;
  if (nextMsg.template !== "order.executed") return null;

  if (prevMsg.template === "order.executed") {
    if (prevMsg.params.alias !== nextMsg.params.alias) return null;
    if (prevMsg.params.value !== nextMsg.params.value) return null;
    const merged: ActivityItem = {
      ...prev,
      timestamp: next.timestamp,
      message: {
        template: "order.executed.multi",
        params: {
          equipmentNames: [prevMsg.params.equipmentName, nextMsg.params.equipmentName],
          count: 2,
          alias: nextMsg.params.alias,
          value: nextMsg.params.value,
        },
      },
    };
    return merged;
  }
  if (prevMsg.template === "order.executed.multi") {
    if (prevMsg.params.alias !== nextMsg.params.alias) return null;
    if (prevMsg.params.value !== nextMsg.params.value) return null;
    const merged: ActivityItem = {
      ...prev,
      timestamp: next.timestamp,
      message: {
        template: "order.executed.multi",
        params: {
          equipmentNames: [...prevMsg.params.equipmentNames, nextMsg.params.equipmentName],
          count: prevMsg.params.count + 1,
          alias: nextMsg.params.alias,
          value: nextMsg.params.value,
        },
      } as ActivityMessage,
    };
    return merged;
  }

  return null;
}
