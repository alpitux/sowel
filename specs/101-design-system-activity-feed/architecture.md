# Architecture — Activity Feed (Spec 101)

## 1. Data model

### 1.1 OrderSource (new, `src/shared/types.ts`)

```typescript
export type OrderSource =
  | { kind: "recipe"; instanceId: string; recipeName: string }
  | { kind: "mode"; modeId: string; modeName: string }
  | { kind: "manual"; userId: string; userName?: string }
  | { kind: "button"; buttonId: string; buttonLabel?: string }
  | { kind: "external"; channel: string };
```

Carried by:

- `executeOrder()` as an optional 4th argument.
- `equipment.order.executed` event as an optional field.
- `ActivityItem.source` (described below).

### 1.2 ActivityItem (new, `src/shared/types.ts`)

```typescript
export type ActivityCategory =
  | "recipe" // recipe lifecycle (start/stop)
  | "mode" // mode change
  | "motion" // motion sensor rising edge
  | "order" // order executed
  | "sunlight" // sunrise/sunset
  | "alarm"; // system.alarm.raised or recipe.instance.error

export interface ActivityItem {
  id: string; // UUID v4
  timestamp: number; // epoch ms
  category: ActivityCategory;
  zoneId: string | null; // null = global (mode, sunlight, alarm, cross-zone recipe)
  message: ActivityMessage;
  source?: OrderSource; // present for category="order" when threaded
}

export type ActivityMessage =
  | { template: "order.executed"; params: { equipmentName: string; alias: string; value: string } }
  | {
      template: "order.executed.multi";
      params: { equipmentNames: string[]; count: number; alias: string; value: string };
    }
  | { template: "motion.detected"; params: { equipmentName: string } }
  | { template: "recipe.started"; params: { recipeName: string } }
  | { template: "recipe.stopped"; params: { recipeName: string } }
  | { template: "recipe.error"; params: { recipeName: string; error: string } }
  | { template: "mode.activated"; params: { modeName: string } }
  | { template: "mode.deactivated"; params: { modeName: string } }
  | { template: "sunlight.sunrise"; params: Record<string, never> }
  | { template: "sunlight.sunset"; params: Record<string, never> }
  | { template: "alarm.raised"; params: { source: string; message: string } };
```

The discriminated union forces the UI to handle every template explicitly (and the i18n keys stay in sync via the type system).

### 1.3 EngineEvent extension

```typescript
| {
    type: "equipment.order.executed";
    equipmentId: string;
    orderAlias: string;
    value: unknown;
    source?: OrderSource;  // ← new
  }

// New event published by ActivityBuffer for WS push:
| { type: "activity.added"; item: ActivityItem }
```

## 2. Event flow

```
Engine event (recipe.started, order.executed, motion, mode.activated, ...)
  ↓ event bus
ActivityBuffer.handleEvent()
  ↓ resolves names + zoneId (sync, lookup in managers)
  ↓ builds ActivityItem
  ↓ pushes to ring buffer (prepend, cap 200, purge >1h)
  ↓ emits "activity.added" on the event bus
    ↓ WS server broadcasts to clients subscribed to "activity" topic
      ↓ useActivity.handleAdded(item) → coalesce + prepend
        ↓ ActivityPanel re-renders
```

On page mount:

```
ActivityPanel.useEffect()
  → GET /api/v1/activity?zoneId=<id>&includeDescendants=true&limit=50
    → ActivityBuffer.getItems({ zoneId, includeDescendants, limit })
      → filtered slice of the ring buffer
    → useActivity.setItems(response.items)
```

## 3. File-level impact

### 3.1 New files

| File                                             | Purpose                               |
| ------------------------------------------------ | ------------------------------------- |
| `src/activity/activity-buffer.ts`                | Ring buffer + subscriber + resolver   |
| `src/activity/activity-buffer.test.ts`           | Unit tests for buffer + resolver      |
| `src/api/routes/activity.ts`                     | `GET /api/v1/activity` route          |
| `ui/src/store/useActivity.ts`                    | Zustand store + coalescing            |
| `ui/src/store/useActivity.test.ts`               | Coalescing logic tests                |
| `ui/src/components/zones/ActivityPanel.tsx`      | The panel component                   |
| `ui/src/components/zones/ActivityItem.tsx`       | Single-item renderer (desktop)        |
| `ui/src/components/zones/ActivityItemMobile.tsx` | Single-item renderer (mobile variant) |
| `ui/src/i18n/fr/activity.json`                   | French strings                        |
| `ui/src/i18n/en/activity.json`                   | English strings                       |

### 3.2 Modified files

| File                                         | Change                                                                                                                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/types.ts`                        | Add `OrderSource`, `ActivityItem`, `ActivityCategory`, `ActivityMessage`; extend `equipment.order.executed`; add `activity.added` event                                                     |
| `src/equipments/equipment-manager.ts`        | `executeOrder()` accepts optional `source` (4th arg); passes it on the emitted event                                                                                                        |
| `src/recipes/engine/recipe.ts`               | `RecipeContext` interface gains `dispatchOrder(equipmentId, alias, value)` — closure bound to `{ kind: "recipe", instanceId, recipeName }` (additive, backward-compat for external plugins) |
| `src/recipes/engine/recipe-manager.ts`       | `buildContext()` builds the dispatcher closure using `registry.get(recipeId).info.name` to resolve `recipeName`                                                                             |
| `src/recipes/engine/light-helpers.ts`        | 3 call sites migrate from `ctx.equipmentManager.executeOrder(...)` to `ctx.dispatchOrder(...)`                                                                                              |
| `src/modes/mode-manager.ts`                  | Mode applier scope builds its own dispatcher closure with `{ kind: "mode", modeId, modeName }`                                                                                              |
| `src/buttons/button-manager.ts`              | Direct caller — passes `{ kind: "button", buttonId }` inline to `executeOrder()`                                                                                                            |
| `src/api/routes/equipments.ts`               | Direct caller — passes `{ kind: "manual", userId: req.user.id }` inline                                                                                                                     |
| `src/api/routes/zones.ts`                    | Same                                                                                                                                                                                        |
| `src/api/server.ts`                          | Register `activity` route; register `"activity"` WS topic                                                                                                                                   |
| `src/api/websocket.ts`                       | Forward `activity.added` events to subscribers of `"activity"` topic                                                                                                                        |
| `src/index.ts`                               | Instantiate `ActivityBuffer` and wire it into the event bus                                                                                                                                 |
| `ui/src/store/useWebSocket.ts`               | Add `"activity"` to `WsTopic`; handle `activity.added` → `useActivity.add(item)`                                                                                                            |
| `ui/src/pages/HomePage.tsx`                  | Replace TODO comment line 207 with `<ActivityPanel zoneId={zoneId} />`                                                                                                                      |
| `ui/src/index.css`                           | Add `.activity__*` and `.mob__act*` BEM rules (copy from polished.html)                                                                                                                     |
| `ui/src/i18n/i18n.ts` (or equivalent loader) | Load the new `activity.json` files                                                                                                                                                          |

### 3.3 Unchanged

- No database migration. No SQLite schema change. No InfluxDB change.
- No new npm dependency.

## 4. i18n keys (excerpt)

```json
{
  "activity": {
    "title": "Activité",
    "subtitle": "dernière heure",
    "live": "live",
    "offline": "offline",
    "empty": "Aucune activité dans la dernière heure",

    "templates": {
      "order.executed": "<b>{{equipmentName}}</b> → {{value}}",
      "order.executed.multi": "<b>{{firstNames}}</b> ×{{count}} → {{value}}",
      "motion.detected": "Mouvement détecté sur <b>{{equipmentName}}</b>",
      "recipe.started": "Recette <b>{{recipeName}}</b> démarrée",
      "recipe.stopped": "Recette <b>{{recipeName}}</b> arrêtée",
      "recipe.error": "Recette <b>{{recipeName}}</b> en erreur",
      "mode.activated": "Mode <b>{{modeName}}</b> activé",
      "mode.deactivated": "Mode <b>{{modeName}}</b> désactivé",
      "sunlight.sunrise": "Lever du soleil",
      "sunlight.sunset": "Coucher du soleil",
      "alarm.raised": "{{source}}: {{message}}"
    },

    "source": {
      "recipe": "par {{recipeName}}",
      "mode": "par le mode {{modeName}}",
      "manual": "manuel",
      "button": "via {{buttonLabel}}",
      "external": "via {{channel}}"
    },

    "time": {
      "now": "à l'instant",
      "minutesAgo_one": "il y a 1 min",
      "minutesAgo_other": "il y a {{count}} min",
      "hoursAgo_one": "il y a 1 h",
      "hoursAgo_other": "il y a {{count}} h"
    },

    "bucket": {
      "current": "{{hour}} → maintenant",
      "past": "{{hour}}"
    }
  }
}
```

The `b` tags use `Trans` from `react-i18next` (same pattern already used elsewhere in the UI).

## 5. ActivityBuffer responsibilities

### 5.1 Resolver

Each handler is a pure function from the source event to an `ActivityItem`:

```typescript
class ActivityBuffer {
  private readonly items: ActivityItem[] = [];
  private readonly MAX = 200;
  private readonly TTL_MS = 60 * 60 * 1000;

  constructor(
    private bus: EventBus,
    private equipmentManager: EquipmentManager,
    private recipeManager: RecipeManager,
    private modeManager: ModeManager,
    private zoneManager: ZoneManager,
    private logger: Logger,
  ) {
    bus.on("equipment.order.executed", this.onOrderExecuted);
    bus.on("equipment.data.changed", this.onDataChanged);
    bus.on("recipe.instance.started", this.onRecipeStarted);
    bus.on("recipe.instance.stopped", this.onRecipeStopped);
    bus.on("recipe.instance.error", this.onRecipeError);
    bus.on("mode.activated", this.onModeActivated);
    bus.on("mode.deactivated", this.onModeDeactivated);
    bus.on("sunlight.changed", this.onSunlightChanged);
    bus.on("system.alarm.raised", this.onAlarmRaised);
  }

  private push(item: ActivityItem): void {
    this.items.unshift(item);
    if (this.items.length > this.MAX) this.items.length = this.MAX;
    const cutoff = Date.now() - this.TTL_MS;
    while (this.items.length && this.items[this.items.length - 1].timestamp < cutoff) {
      this.items.pop();
    }
    this.bus.emit({ type: "activity.added", item });
  }

  getItems(opts: {
    zoneId: string | null;
    includeDescendants?: boolean;
    limit?: number;
  }): ActivityItem[] {
    const { zoneId, includeDescendants = true, limit = 50 } = opts;
    const allowedZones = zoneId
      ? new Set([zoneId, ...(includeDescendants ? this.zoneManager.getDescendants(zoneId) : [])])
      : null;
    return this.items
      .filter((it) => it.zoneId === null || allowedZones === null || allowedZones.has(it.zoneId))
      .slice(0, limit);
  }
}
```

### 5.2 Filtering rules

- `equipment.data.changed` is processed **only** when `alias === "motion"` and `value === true` (rising edge). All other data changes are dropped at the buffer.
- `recipe.instance.state.changed` is **not** buffered — too noisy and not actionable in the feed.
- `equipment.created/updated/removed` is **not** buffered — admin churn.

### 5.3 Zone resolution

- `equipment.order.executed` → `equipmentManager.getEquipment(equipmentId).zoneId`
- `equipment.data.changed` (motion) → same
- `recipe.instance.*` → `recipeManager.getInstance(instanceId).slots.zone?.value ?? null` (null when `crossZone` or no zone slot)
- `mode.*`, `sunlight.*`, `system.alarm.*` → `null`

## 6. Coalescing rule (client-side)

```typescript
function coalesce(prev: ActivityItem | undefined, next: ActivityItem): ActivityItem | null {
  if (!prev) return null;
  if (next.timestamp - prev.timestamp > 500) return null;
  if (prev.category !== "order" || next.category !== "order") return null;
  if (JSON.stringify(prev.source) !== JSON.stringify(next.source)) return null;

  const prevMsg = prev.message;
  const nextMsg = next.message;
  if (nextMsg.template !== "order.executed") return null;
  if (prevMsg.template === "order.executed") {
    if (prevMsg.params.alias !== nextMsg.params.alias) return null;
    if (prevMsg.params.value !== nextMsg.params.value) return null;
    return {
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
  }
  if (prevMsg.template === "order.executed.multi") {
    if (prevMsg.params.alias !== nextMsg.params.alias) return null;
    if (prevMsg.params.value !== nextMsg.params.value) return null;
    return {
      ...prev,
      timestamp: next.timestamp,
      message: {
        ...prevMsg,
        params: {
          ...prevMsg.params,
          equipmentNames: [...prevMsg.params.equipmentNames, nextMsg.params.equipmentName],
          count: prevMsg.params.count + 1,
        },
      },
    };
  }
  return null;
}
```

Coalescing happens at the client (not the server) because the 500 ms window assumes the user sees the items as one batch; server-side batching would couple to runtime scheduling. Server pushes individual items; the client decides how to render.

## 7. Auth & topic subscription

- `GET /api/v1/activity` requires bearer auth (same middleware as the rest of `/api/v1/*`).
- WS topic `"activity"` is added to the typed `WsTopic` union. The zone view's `useWsSubscription` includes it in the topic list.
- Permission: any authenticated user (admin / user / viewer) can read activity. The feed contains no secrets; values are the same data already streamed via existing topics.

## 8. Performance

- Ring buffer ops are O(1) on push, O(n) on `getItems` with n ≤ 200 — negligible.
- Server emits `activity.added` only for buffered items, so noisy events (device.data.updated) don't reach the WS topic.
- Client coalescing is O(1) on insert.
- One `setInterval(60_000)` global for relative-time refresh — no per-item timer.
- Empty zone (no events in 1h): the panel renders the empty state, no extra fetch.

## 9. Failure modes

| Failure                                  | Behavior                                                                                                                               |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| WS disconnected                          | `● live` becomes `○ offline`. New items don't arrive but the panel still shows the buffered ones.                                      |
| Bootstrap fetch fails (network / auth)   | Panel renders the empty state + a small "Impossible de charger l'activité" footnote. WS push still wires through if it connects later. |
| Backend restart                          | Buffer is empty. Panel shows empty state until events fire. Same as logs.                                                              |
| Equipment renamed mid-buffer             | The item keeps the name captured at emission time. Rename takes effect on subsequent items. Acceptable.                                |
| `executeOrder()` called without `source` | Buffer records `source: undefined`. UI shows the order without "par X" — degrades gracefully.                                          |

## 10. Source attribution pattern (context-bound dispatcher)

`equipment-manager.executeOrder()` accepts an optional 4th argument `source?: OrderSource`. External plugins keep working unchanged. Internal callers go through one of three patterns depending on whether the call site has a stable "current source" scope:

### 10.1 Pattern A — context-bound dispatcher (recipes, modes)

When a long-lived execution scope has a stable source (a recipe instance, a mode being applied), the scope **builds a closure** that pre-injects the source:

```typescript
// recipe-manager.buildContext()
private buildContext(instanceId: string, recipeId: string): RecipeContext {
  const recipeName = this.registry.get(recipeId)?.info.name ?? recipeId;
  const source: OrderSource = { kind: "recipe", instanceId, recipeName };
  return {
    // ... existing fields
    equipmentManager: this.equipmentManager,         // direct access preserved (plugin compat)
    dispatchOrder: (equipmentId, alias, value) =>
      this.equipmentManager.executeOrder(equipmentId, alias, value, source),
  };
}
```

Recipe helpers migrate:

```diff
- ctx.equipmentManager.executeOrder(lightId, "state", "on")
+ ctx.dispatchOrder(lightId, "state", "on")
```

Mode applier follows the same pattern with a local dispatcher closure built inside the apply scope.

### 10.2 Pattern B — direct caller with inline source (buttons, API routes)

Leaf callers that already know everything they need at the call site construct the source inline:

```typescript
// buttons/button-manager.ts
await equipmentManager.executeOrder(binding.equipmentId, binding.alias, binding.value, {
  kind: "button",
  buttonId: binding.buttonId,
});

// api/routes/equipments.ts (POST /equipments/:id/orders)
await equipmentManager.executeOrder(equipmentId, alias, value, {
  kind: "manual",
  userId: req.user.id,
});
```

### 10.3 Why this pattern over plain threading

| Property                                 | Plain threading               | Context-bound dispatcher                                                   |
| ---------------------------------------- | ----------------------------- | -------------------------------------------------------------------------- |
| Helpers know about `source`              | Yes (each helper threads it)  | No (closure injects it)                                                    |
| New helper forgets attribution           | Possible                      | Quasi-impossible (the dispatcher API forces it)                            |
| Plugin compat                            | Same                          | Same                                                                       |
| Lines changed in helpers                 | 1 per call site (add 4th arg) | 1 per call site (rename `equipmentManager.executeOrder` → `dispatchOrder`) |
| Future metadata (requestId, dryRun, ...) | Thread through every helper   | Add to the closure, helpers untouched                                      |

The dispatcher closure is a **scoped capability**: each recipe / mode invocation builds a dispatcher pre-loaded with its own attribution. Helpers consume the capability without knowing its internals.

### 10.4 Plugin upgrade path (external recipes)

External recipe plugins use `ctx.equipmentManager.executeOrder(...)` today. They keep working — their orders emit with `source: undefined`, the UI degrades to "Appliques → 4 %" without "par X". Documentation recommends switching to `ctx.dispatchOrder(...)` to gain attribution. Non-breaking, opt-in upgrade.

---

## 11. Compatibility with future specs

- Spec 102 (Recipe modal + per-mode overrides) is independent. The activity feed shows "par <recipeName>" regardless of which mode override was active.
- A future cross-zone Dashboard feed reuses the same `ActivityBuffer.getItems({ zoneId: null })` API path — no code change needed there.
