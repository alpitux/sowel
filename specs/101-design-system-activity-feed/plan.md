# Plan — Activity Feed (Spec 101)

## Implementation order

Follows the canonical Sowel order: types → core → backend domain → routes → WS → frontend → i18n. Within each phase, list the tasks as checkboxes for tracking.

### Phase A — Types (backend + shared)

- [ ] Add `OrderSource`, `ActivityCategory`, `ActivityMessage`, `ActivityItem` to `src/shared/types.ts`.
- [ ] Extend `EngineEvent`:
  - `equipment.order.executed` gains `source?: OrderSource`.
  - Add `{ type: "activity.added"; item: ActivityItem }`.
- [ ] `npx tsc --noEmit` green.

### Phase B — equipment-manager.executeOrder source plumbing

- [ ] `executeOrder(equipmentId, alias, value, source?)` accepts the optional 4th arg ([equipment-manager.ts:740-783](../../src/equipments/equipment-manager.ts#L740-L783)).
- [ ] The emitted `equipment.order.executed` event includes the source when present.
- [ ] Backward-compat: all existing test fixtures keep passing without modification.

### Phase C — Context-bound dispatcher (recipes + modes) + inline source (buttons + routes)

Per architecture.md §10. Two patterns depending on the call site shape.

**C.1 Recipe context dispatcher**

- [ ] `src/recipes/engine/recipe.ts`: add `dispatchOrder(equipmentId: string, alias: string, value: unknown): Promise<void>` to `RecipeContext`.
- [ ] `src/recipes/engine/recipe-manager.ts` — `buildContext()` ([recipe-manager.ts:478](../../src/recipes/engine/recipe-manager.ts#L478)):
  - Resolve `recipeName = this.registry.get(recipeId)?.info.name ?? recipeId` once at context build time.
  - Build a closure `dispatchOrder = (eq, alias, val) => equipmentManager.executeOrder(eq, alias, val, { kind: "recipe", instanceId, recipeName })`.
  - Include in returned context.
- [ ] `src/recipes/engine/light-helpers.ts`: migrate the 3 call sites:
  - `lines 43, 61, 88`: `ctx.equipmentManager.executeOrder(...)` → `ctx.dispatchOrder(...)`.
- [ ] Other internal recipe helpers (search `ctx.equipmentManager.executeOrder` under `src/recipes/`): same migration.

**C.2 Mode applier dispatcher**

- [ ] `src/modes/mode-manager.ts` — in the mode apply scope:
  - Build local `dispatchOrder = (eq, alias, val) => equipmentManager.executeOrder(eq, alias, val, { kind: "mode", modeId: mode.id, modeName: mode.name })`.
  - Use it for every order emitted while applying the mode.

**C.3 Direct callers (inline source)**

- [ ] `src/buttons/button-manager.ts`: pass `{ kind: "button", buttonId: binding.buttonId }` as 4th arg inline.
- [ ] `src/api/routes/equipments.ts` (POST `/equipments/:id/orders`): pass `{ kind: "manual", userId: req.user.id }` inline.
- [ ] `src/api/routes/zones.ts` (zone-level orders, allShuttersOpen/Close, allLightsOn/Off): same.
- [ ] Any other internal direct caller discovered by `grep -rn "equipmentManager.executeOrder(" src/`: same treatment with appropriate source kind.

**Verification**: after this phase, every internal call site to `executeOrder` either goes through a context dispatcher (recipes, modes) or passes an inline source (buttons, routes). External plugin call sites stay unchanged and emit `source: undefined` — graceful degradation.

### Phase D — ActivityBuffer

- [ ] Create `src/activity/activity-buffer.ts` per architecture.md §5.
- [ ] Subscribe to: `equipment.order.executed`, `equipment.data.changed`, `recipe.instance.started/stopped/error`, `mode.activated/deactivated`, `sunlight.changed`, `system.alarm.raised`.
- [ ] Resolver helpers: equipment name + zoneId via `EquipmentManager`; recipe name + zoneId via `RecipeManager`; mode name via `ModeManager`.
- [ ] Filter rule: `equipment.data.changed` only when `alias === "motion"` and `value === true`.
- [ ] Ring buffer cap = 200 items; TTL = 1h; purge on each push.
- [ ] Emit `activity.added` on the bus after each push.
- [ ] `getItems({ zoneId, includeDescendants, limit })` returns the filtered slice.
- [ ] Wire into `src/index.ts`: instantiate after managers, pass to API server for the route handler.

### Phase E — REST route

- [ ] Create `src/api/routes/activity.ts` exposing `GET /api/v1/activity`.
- [ ] Auth: standard bearer middleware.
- [ ] Query params: `zoneId` (UUID, required), `includeDescendants` (boolean, default true), `limit` (int 1-50, default 50).
- [ ] Calls `activityBuffer.getItems(...)`.
- [ ] Register in `src/api/server.ts`.

### Phase F — WebSocket topic

- [ ] Add `"activity"` to the WS topic union (server-side and `ui/src/store/useWebSocket.ts`).
- [ ] In `src/api/websocket.ts`, forward `activity.added` events to subscribers of the `"activity"` topic.
- [ ] The zone view subscribes via `useWsSubscription(["activity", ...])`.

### Phase G — Frontend store

- [ ] Create `ui/src/store/useActivity.ts` (Zustand).
  - State: `{ items: ActivityItem[]; capacity: 50; status: "idle"|"loading"|"ready"|"error" }`.
  - Actions: `setItems`, `addItem` (with coalescing), `reset` (on zone change).
- [ ] Coalescing helper per architecture.md §6.
- [ ] In `ui/src/store/useWebSocket.ts` `handleEvent()`: case `"activity.added"` → `useActivity.getState().addItem(event.item)`.

### Phase H — ActivityPanel component

- [ ] Create `ui/src/components/zones/ActivityPanel.tsx`.
  - Props: `{ zoneId: string }`.
  - On mount: `useActivity.reset()` then `fetch('/api/v1/activity?zoneId=X&...')` → `setItems`.
  - Renders the `Panel` chrome (existing component) with title "Activité", subtitle "dernière heure", and the `● live`/`○ offline` pill from `useWebSocket.status`.
  - Body: items grouped by hour bucket (helper `groupByHour(items, now)`).
  - Empty state when items.length === 0.
- [ ] Create `ui/src/components/zones/ActivityItem.tsx` (desktop).
  - 5 icon variants (`recipe`, `mode`, `motion`, `neutral`, `alarm`).
  - Lucide icons: `ChefHat` (recipe), `Layers` (mode), `PersonStanding` (motion), `Sun`/`Moon` (sunlight), `AlertTriangle` (alarm).
  - Renders the message via `Trans` for `<b>` interpolation.
  - Renders "par X" suffix using the source attribution helper.
- [ ] Create `ui/src/components/zones/ActivityItemMobile.tsx`.
  - Tighter layout per `.mob__act*` CSS.
  - Pastille couleur instead of icon (6 px circle).
- [ ] Add CSS rules to `ui/src/index.css`:
  - `.activity`, `.activity__group`, `.activity__item`, `.activity__item-icon`, `.activity__item-text`, `.activity__item-time`, with `--recipe`/`--mode`/`--motion`/`--alarm` modifiers (copy from polished.html lines 971-1003).
  - `.mob__act*` (copy from lines 1937-1955).
- [ ] Global relative-time timer: `useEffect(() => { const id = setInterval(forceTick, 60_000); return () => clearInterval(id); }, [])` in a hook `useRelativeTimeTick()` (one instance, hosted at panel level).

### Phase I — i18n

- [ ] Create `ui/src/i18n/fr/activity.json` with the keys listed in architecture.md §4.
- [ ] Create `ui/src/i18n/en/activity.json` (translations).
- [ ] Register both files in the i18n loader.

### Phase J — Wire into HomePage

- [ ] Replace the comment at [HomePage.tsx:207](../../ui/src/pages/HomePage.tsx#L207) with `<ActivityPanel zoneId={zoneId} />`.
- [ ] Verify mobile responsive: panel stacks below `Comportements`.

### Phase K — Validation

- [ ] `npx tsc --noEmit` green.
- [ ] `cd ui && npx tsc -b --noEmit` green.
- [ ] `npx vitest run` — all tests pass (existing + new).
- [ ] `npx eslint src/ --ext .ts` — zero errors.
- [ ] Smoke test on dev server: open a zone, trigger a manual order via UI, see the row appear with `manuel` attribution. Trigger a recipe (simulate motion), see `par <recipeName>`.

## Test plan

### Modules to test

- `src/activity/activity-buffer.ts` (new, business logic)
- `ui/src/store/useActivity.ts` (new, coalescing logic)

### Backend scenarios (`activity-buffer.test.ts`)

| Scenario                                                          | Expected                                                                           |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `equipment.order.executed` with `source.kind="recipe"`            | Buffer has 1 item, category=`order`, source preserved, `zoneId` = equipment.zoneId |
| `equipment.order.executed` without `source`                       | Buffer has 1 item, source `undefined`, item still emitted                          |
| `equipment.data.changed` with `alias="motion"`, `value=true`      | Buffer has 1 item, category=`motion`                                               |
| `equipment.data.changed` with `alias="motion"`, `value=false`     | Buffer empty (falling edge dropped)                                                |
| `equipment.data.changed` with `alias="temperature"`, `value=21.5` | Buffer empty (not motion)                                                          |
| `recipe.instance.started` for a zone-bound recipe                 | Buffer has 1 item, `zoneId` resolved from slot                                     |
| `recipe.instance.started` for a crossZone recipe                  | Buffer has 1 item, `zoneId=null`                                                   |
| `mode.activated`                                                  | Buffer has 1 item, `zoneId=null`                                                   |
| `sunlight.changed` near sunrise                                   | Buffer has 1 item, template `sunlight.sunrise`                                     |
| `sunlight.changed` near sunset                                    | Buffer has 1 item, template `sunlight.sunset`                                      |
| `system.alarm.raised`                                             | Buffer has 1 item, category=`alarm`                                                |
| `device.data.updated`                                             | Buffer empty (not eligible)                                                        |
| `equipment.created`                                               | Buffer empty (admin churn)                                                         |
| Push 250 items                                                    | Buffer capped at 200, oldest dropped                                               |
| Push item with timestamp > 1h ago, then a new one                 | Old item purged during the new push                                                |
| `getItems({ zoneId, includeDescendants: true })` for parent zone  | Returns items from parent + children + global                                      |
| `getItems({ zoneId, includeDescendants: false })`                 | Returns items from the exact zone + global only                                    |
| `getItems({ zoneId: null })`                                      | Returns all items                                                                  |
| `getItems({ limit: 5 })`                                          | Returns at most 5 items, most recent first                                         |
| Every push emits `activity.added` on the bus                      | Mock listener receives N events for N pushes                                       |

### Frontend scenarios (`useActivity.test.ts`)

| Scenario                                                                                                                    | Expected                            |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `setItems(items)` then `getState().items`                                                                                   | Same array, capped at 50            |
| `addItem(x)` on empty store                                                                                                 | items = [x]                         |
| `addItem(y)` after `addItem(x)` where x.timestamp + 300ms = y.timestamp, same source, same template, same alias, same value | items = [merged.multi { count: 2 }] |
| `addItem(z)` after a coalesced `*.multi` row, same source/alias/value, within window                                        | items = [merged.multi { count: 3 }] |
| `addItem(y)` with different `source`                                                                                        | items = [y, x] (no merge)           |
| `addItem(y)` with different `alias`                                                                                         | items = [y, x] (no merge)           |
| `addItem(y)` with timestamp gap > 500ms                                                                                     | items = [y, x] (window expired)     |
| `addItem` for a non-order category (e.g. motion)                                                                            | Never coalesces                     |
| `addItem` past capacity 50                                                                                                  | Oldest item dropped                 |
| `reset()`                                                                                                                   | items = []                          |

### Manual verification (Phase K smoke test)

| Action                                                   | Expected                                                                                |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Open the Séjour zone view                                | Activity panel renders right of Comportements (desktop)                                 |
| Click a light's power button manually                    | Row appears at top with "manuel" attribution within 1s                                  |
| Wait for Motion Light recipe to fire (or trigger motion) | Single row "Mouvement détecté sur PIR_00" + within 500ms a coalesced row for the lights |
| Reload the page                                          | Feed bootstraps with the last hour of items (not empty)                                 |
| Disconnect WS (kill backend briefly)                     | Pill flips to `○ offline`; items stay                                                   |
| Reconnect                                                | Pill flips back to `● live`; new items resume                                           |
| Open a child zone (e.g. Séjour while parent is Maison)   | Items from the parent view include the child's items via `includeDescendants=true`      |
| Resize to mobile width                                   | Panel uses `.mob__act` layout, pastille couleur, tighter padding                        |

## Risks & mitigations

| Risk                                                                                                             | Mitigation                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A new internal recipe helper bypasses `ctx.dispatchOrder` and calls `ctx.equipmentManager.executeOrder` directly | The SDK API guides toward `ctx.dispatchOrder`. PR review catches direct uses. Cosmetic-only impact (no attribution).                                    |
| External recipe plugins keep emitting orders without attribution                                                 | By design — non-breaking. Documentation updated to recommend `ctx.dispatchOrder`. Opt-in upgrade.                                                       |
| Coalescing eats genuine separate orders (two users clicking 2 different lamps simultaneously)                    | Coalescing requires identical `source.id`; manual orders carry distinct `userId`, so different users never merge. Same user / same recipe is by design. |
| Ring buffer leaks memory if events spike                                                                         | Hard cap at 200 items + 1h TTL; pop loop on every push prevents unbounded growth.                                                                       |
| Global events (mode, sunlight) flood every zone feed                                                             | Acceptable by design — mode/sunlight are infrequent (≤10/day).                                                                                          |
| `recipeName` not yet on recipe context                                                                           | Phase C explicitly adds it; cross-cutting change but localised.                                                                                         |
| Empty state UX undertested                                                                                       | Manual verification step (Phase K) covers reload on a freshly-restarted backend.                                                                        |

## Estimated effort

- Phase A-C (backend types + executeOrder + plumbing): ~3-4 h, mostly mechanical
- Phase D-F (buffer + route + WS): ~3 h
- Phase G-J (frontend store + components + i18n + wire): ~4-5 h
- Phase K (validation + smoke test): ~1 h

Total ~12 h of work in 1-2 focused sessions. Single PR.
