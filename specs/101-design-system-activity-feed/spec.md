# Spec 101 — Design System Phase 7: Activity Feed

> Light scoping spec — part of the [094 UI redesign umbrella](../094-ui-redesign/spec.md). Expanded into full spec when picked up via `/sowel-feature`.

## Problem

The zone view has no activity feed. Today, the "what just happened in this zone" answer requires opening Logs or guessing from the equipment state. The design system specs an `ActivityPanel` that lives next to the zone content (desktop right column, mobile bottom drawer).

## Goal

Implement a new `ActivityPanel` component fed by the existing WebSocket events stream (no backend work). Display the last N events with timestamp, equipment, action.

## In scope

- New `ActivityPanel.tsx` component in `ui/src/components/zones/`.
- Filter the WebSocket event stream by zone (events have `zoneId`).
- Display latest events with relative time (`il y a 3 min`).
- Use `.activity__*` BEM classes.
- Cap the feed at ~50 items (in-memory, no persistence).

## Out of scope

- Backend changes — the events stream already exists.
- Persistence (events are lost on page reload — fine for v1).
- Cross-zone activity (each zone view shows only its own).

## Acceptance criteria

- [ ] `ActivityPanel` renders in zone view (desktop right column)
- [ ] Mobile: scroll-to-bottom area shows the feed
- [ ] Events filtered correctly by zone
- [ ] Relative time updates without re-render storm
- [ ] No console errors when events stream is idle

## References

- [design-system/components/activity-item.md](../../design-system/components/activity-item.md)
- [design-system/migration.md](../../design-system/migration.md) Phase 7
