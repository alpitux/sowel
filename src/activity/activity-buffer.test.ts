import { describe, it, expect, beforeEach, vi } from "vitest";
import { ActivityBuffer } from "./activity-buffer.js";
import { EventBus } from "../core/event-bus.js";
import { createLogger } from "../core/logger.js";
import type { Equipment } from "../shared/types.js";

const logger = createLogger("silent").logger;

function mkEquipment(id: string, name: string, zoneId: string | null): Equipment {
  return {
    id,
    name,
    type: "light_onoff",
    zoneId,
    enabled: true,
    icon: null,
    pinned: false,
    createdAt: new Date().toISOString(),
  };
}

function buildHarness() {
  const bus = new EventBus(logger);
  const equipments = new Map<string, Equipment>();
  const instances = new Map<
    string,
    { recipeId: string; recipeName: string; zoneId: string | null }
  >();
  const descendants = new Map<string, string[]>();
  let isDaylight: boolean | null = false;

  const equipmentManager = {
    getById: (id: string) => equipments.get(id) ?? null,
  } as unknown as Parameters<typeof ActivityBuffer.prototype.constructor>[1];

  const recipeManager = {
    getInstanceMeta: (id: string) => instances.get(id) ?? null,
  } as unknown as Parameters<typeof ActivityBuffer.prototype.constructor>[2];

  const zoneManager = {
    getDescendantIds: (zoneId: string) => [zoneId, ...(descendants.get(zoneId) ?? [])],
  } as unknown as Parameters<typeof ActivityBuffer.prototype.constructor>[3];

  const sunlightManager = {
    getSunlightData: () => ({ sunrise: null, sunset: null, isDaylight }),
  } as unknown as Parameters<typeof ActivityBuffer.prototype.constructor>[4];

  const buffer = new ActivityBuffer(
    bus,
    equipmentManager,
    recipeManager,
    zoneManager,
    sunlightManager,
    logger,
  );
  buffer.start();

  return {
    bus,
    buffer,
    addEquipment: (eq: Equipment) => equipments.set(eq.id, eq),
    addInstance: (
      id: string,
      meta: { recipeId: string; recipeName: string; zoneId: string | null },
    ) => instances.set(id, meta),
    setDescendants: (zoneId: string, descIds: string[]) => descendants.set(zoneId, descIds),
    setIsDaylight: (v: boolean | null) => {
      isDaylight = v;
    },
  };
}

describe("ActivityBuffer", () => {
  let h: ReturnType<typeof buildHarness>;

  beforeEach(() => {
    h = buildHarness();
  });

  describe("order events", () => {
    it("records equipment.order.executed with source preserved", () => {
      h.addEquipment(mkEquipment("eq-1", "Apliques", "zone-living"));
      h.bus.emit({
        type: "equipment.order.executed",
        equipmentId: "eq-1",
        orderAlias: "brightness",
        value: 0.04,
        source: { kind: "recipe", instanceId: "inst-x", recipeName: "Motion Light" },
      });
      const items = h.buffer.getItems();
      expect(items).toHaveLength(1);
      expect(items[0].category).toBe("order");
      expect(items[0].zoneId).toBe("zone-living");
      expect(items[0].source).toEqual({
        kind: "recipe",
        instanceId: "inst-x",
        recipeName: "Motion Light",
      });
      expect(items[0].message.template).toBe("order.executed");
    });

    it("records equipment.order.executed without source (source undefined)", () => {
      h.addEquipment(mkEquipment("eq-1", "Light", "zone-living"));
      h.bus.emit({
        type: "equipment.order.executed",
        equipmentId: "eq-1",
        orderAlias: "state",
        value: "ON",
      });
      expect(h.buffer.getItems()).toHaveLength(1);
      expect(h.buffer.getItems()[0].source).toBeUndefined();
    });

    it("ignores order from unknown equipment (silently)", () => {
      h.bus.emit({
        type: "equipment.order.executed",
        equipmentId: "ghost",
        orderAlias: "state",
        value: "ON",
      });
      expect(h.buffer.getItems()).toHaveLength(0);
    });
  });

  describe("motion filter", () => {
    beforeEach(() => {
      h.addEquipment(mkEquipment("pir-1", "PIR_00", "zone-living"));
    });

    it("records motion=true rising edge", () => {
      h.bus.emit({
        type: "equipment.data.changed",
        equipmentId: "pir-1",
        alias: "motion",
        value: true,
        previous: false,
      });
      expect(h.buffer.getItems()).toHaveLength(1);
      expect(h.buffer.getItems()[0].category).toBe("motion");
    });

    it("ignores motion=false (falling edge)", () => {
      h.bus.emit({
        type: "equipment.data.changed",
        equipmentId: "pir-1",
        alias: "motion",
        value: false,
        previous: true,
      });
      expect(h.buffer.getItems()).toHaveLength(0);
    });

    it("ignores temperature changes", () => {
      h.bus.emit({
        type: "equipment.data.changed",
        equipmentId: "pir-1",
        alias: "temperature",
        value: 21.5,
        previous: 21,
      });
      expect(h.buffer.getItems()).toHaveLength(0);
    });
  });

  describe("recipe lifecycle", () => {
    it("records recipe.instance.started with zone resolved", () => {
      h.addInstance("inst-1", { recipeId: "r1", recipeName: "Motion Light", zoneId: "zone-A" });
      h.bus.emit({ type: "recipe.instance.started", instanceId: "inst-1", recipeId: "r1" });
      const items = h.buffer.getItems();
      expect(items).toHaveLength(1);
      expect(items[0].category).toBe("recipe");
      expect(items[0].zoneId).toBe("zone-A");
      expect(items[0].message).toEqual({
        template: "recipe.started",
        params: { recipeName: "Motion Light" },
      });
    });

    it("records cross-zone recipe with zoneId=null", () => {
      h.addInstance("inst-x", { recipeId: "r1", recipeName: "Sunset Shutters", zoneId: null });
      h.bus.emit({ type: "recipe.instance.started", instanceId: "inst-x", recipeId: "r1" });
      expect(h.buffer.getItems()[0].zoneId).toBeNull();
    });

    it("records recipe.instance.error as alarm category", () => {
      h.addInstance("inst-1", { recipeId: "r1", recipeName: "X", zoneId: null });
      h.bus.emit({
        type: "recipe.instance.error",
        instanceId: "inst-1",
        recipeId: "r1",
        error: "boom",
      });
      expect(h.buffer.getItems()[0].category).toBe("alarm");
    });

    it("ignores recipe events for unknown instance", () => {
      h.bus.emit({ type: "recipe.instance.started", instanceId: "ghost", recipeId: "r" });
      expect(h.buffer.getItems()).toHaveLength(0);
    });
  });

  describe("mode events", () => {
    it("records mode.activated as global (zoneId=null)", () => {
      h.bus.emit({ type: "mode.activated", modeId: "m1", modeName: "Lumière soir" });
      const items = h.buffer.getItems();
      expect(items).toHaveLength(1);
      expect(items[0].category).toBe("mode");
      expect(items[0].zoneId).toBeNull();
    });

    it("records mode.deactivated", () => {
      h.bus.emit({ type: "mode.deactivated", modeId: "m1", modeName: "Lumière soir" });
      expect(h.buffer.getItems()[0].message.template).toBe("mode.deactivated");
    });
  });

  describe("sunlight transitions", () => {
    it("records sunrise when isDaylight flips false→true", () => {
      h.setIsDaylight(true);
      h.bus.emit({ type: "sunlight.changed" });
      const items = h.buffer.getItems();
      expect(items).toHaveLength(1);
      expect(items[0].message.template).toBe("sunlight.sunrise");
      expect(items[0].zoneId).toBeNull();
    });

    it("records sunset when isDaylight flips true→false", () => {
      h.setIsDaylight(true);
      h.bus.emit({ type: "sunlight.changed" });
      h.setIsDaylight(false);
      h.bus.emit({ type: "sunlight.changed" });
      const items = h.buffer.getItems();
      expect(items).toHaveLength(2);
      expect(items[0].message.template).toBe("sunlight.sunset");
    });

    it("ignores sunlight.changed when isDaylight unchanged", () => {
      h.setIsDaylight(false);
      h.bus.emit({ type: "sunlight.changed" });
      expect(h.buffer.getItems()).toHaveLength(0);
    });
  });

  describe("alarms", () => {
    it("records system.alarm.raised as global alarm", () => {
      h.bus.emit({
        type: "system.alarm.raised",
        alarmId: "a1",
        level: "error",
        source: "z2m",
        message: "broker disconnected",
      });
      expect(h.buffer.getItems()[0]).toMatchObject({
        category: "alarm",
        zoneId: null,
        message: { template: "alarm.raised" },
      });
    });
  });

  describe("filter by zone", () => {
    beforeEach(() => {
      h.addEquipment(mkEquipment("eq-a", "EqA", "zone-A"));
      h.addEquipment(mkEquipment("eq-b", "EqB", "zone-B"));
      h.setDescendants("zone-parent", ["zone-A"]);
      h.bus.emit({
        type: "equipment.order.executed",
        equipmentId: "eq-a",
        orderAlias: "state",
        value: "ON",
      });
      h.bus.emit({
        type: "equipment.order.executed",
        equipmentId: "eq-b",
        orderAlias: "state",
        value: "ON",
      });
      h.bus.emit({ type: "mode.activated", modeId: "m", modeName: "Day" }); // global
    });

    it("returns zone-A items + global when filtering by zone-A", () => {
      const items = h.buffer.getItems({ zoneId: "zone-A", includeDescendants: true });
      const zones = items.map((i) => i.zoneId);
      expect(zones).toContain("zone-A");
      expect(zones).toContain(null);
      expect(zones).not.toContain("zone-B");
    });

    it("includes descendants when filtering by parent", () => {
      const items = h.buffer.getItems({ zoneId: "zone-parent", includeDescendants: true });
      expect(items.some((i) => i.zoneId === "zone-A")).toBe(true);
    });

    it("excludes descendants when includeDescendants=false", () => {
      const items = h.buffer.getItems({ zoneId: "zone-parent", includeDescendants: false });
      expect(items.some((i) => i.zoneId === "zone-A")).toBe(false);
    });

    it("returns all items when zoneId is null", () => {
      const items = h.buffer.getItems({ zoneId: null });
      expect(items.length).toBe(3);
    });

    it("respects the limit", () => {
      const items = h.buffer.getItems({ zoneId: null, limit: 1 });
      expect(items.length).toBe(1);
    });
  });

  describe("ring buffer cap and emit", () => {
    it("emits activity.added on the bus for every push", () => {
      const onActivity = vi.fn();
      h.bus.onType("activity.added", onActivity);
      h.bus.emit({ type: "mode.activated", modeId: "m1", modeName: "A" });
      h.bus.emit({ type: "mode.activated", modeId: "m2", modeName: "B" });
      expect(onActivity).toHaveBeenCalledTimes(2);
    });

    it("caps the buffer at 200 items", () => {
      for (let i = 0; i < 250; i++) {
        h.bus.emit({ type: "mode.activated", modeId: `m${i}`, modeName: `M${i}` });
      }
      expect(h.buffer.size()).toBe(200);
    });
  });
});
