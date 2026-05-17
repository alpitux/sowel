# Release notes

Sowel has been versioned and shipped through CI/CD since `v1.0.0` (April 2026, spec 055). Every release is published as:

- A signed GitHub release with a generated changelog — [github.com/mchacher/sowel/releases](https://github.com/mchacher/sowel/releases)
- A multi-arch Docker image tagged `ghcr.io/mchacher/sowel:<version>` and `:latest`

This page summarises every published version, newest first. For the full diff between two versions use `https://github.com/mchacher/sowel/compare/v<a>...v<b>`.

**Updating a running instance.** Sowel polls GitHub every hour and surfaces the available update in the topbar. Click the pill to open the updates sheet and apply the new version in one click (added in v1.9.0). On the command line: `cd /opt/sowel && docker compose pull && docker compose up -d`.

---

## 1.9.x — Actionable updates pill

### v1.9.0 — 2026-05-17

- Topbar updates pill now opens an `UpdatesSheet` listing Sowel core + outdated plugins, with a one-click `Update` button per row (spec 106). Replaces the old blind redirect to `/plugins`, which left core updates invisible.

---

## 1.8.x — Charts & activity feed

### v1.8.1 — 2026-05-17

- Time-series charts now use a linear time scale on the X axis. Motion / contact / sparse weather data is no longer visually compressed when events are bunched in time.

### v1.8.0 — 2026-05-16

- New activity feed in zone view (spec 101). Shows the last 24 h of events with a responsive cap (10 on mobile, 100 on desktop), filtered by binding category and scoped to the current zone.

---

## 1.7.x — WAN hardening

### v1.7.0 — 2026-05-15

- WAN hardening (spec 105): CSP and WebSocket Origin check tightened for safe public exposure behind a Cloudflare tunnel. Google Fonts allow-listed for the Nunito heading font. Docker socket accessible to the non-root `sowel` user.
- CI: native ARM64 GitHub runner with parallel builds — multi-arch release time dropped from ~15 min to ~3 min.

---

## 1.6.x — Design system + plugin supply chain

### v1.6.6 — 2026-05-15

- Setup wizard auto-triggers the restart after submit; unified decimal separator for latitude/longitude inputs.
- CI: GHCR retention policy — old container versions auto-pruned on each release.

### v1.6.5 — 2026-05-15

- First-login Home setup wizard. Restart helper now passes `--force-recreate` so it actually restarts.

### v1.6.4 — 2026-05-15

- Plugin install only refuses _escaping_ symlinks now; internal symlinks are allowed (spec 089 C1).

### v1.6.3 — 2026-05-14

- Self-update normalises the compose file to `:latest`, force-recreates the container, and verifies the new version (spec 104).
- CI: GitHub Release creation gated behind successful ARM64 build.

### v1.6.2 — 2026-05-14

- Plugin supply chain hardening (spec 089 C1+C2): SHA256 hashes pinned in the registry, community-namespace install confirmation, restore path confinement, extension whitelist, symlink refusal, size cap.

### v1.6.1 — 2026-05-14

- Docker build fix — `design-system/` is now copied into the UI build stage.

### v1.6.0 — 2026-05-14

- Major UI overhaul to design-system parity (specs 094–100):
  - New design-system palette and tokens
  - Sidebar refactored into reusable components
  - Zone view 2-column layout on desktop with cluster aggregation strip and variant pills
  - Icon-only zone command toolbar
  - Dashboard widget chrome unified
  - Typography polish (letter-spacing, H1 standardisation, tabular nums by default)
  - Equipment row chrome refactor and light-on glow
  - Strict mock alignment on zone panels, mobile parity with mockup
- One-command installer (`install.sh`) added.

---

## 1.5.x — Energy & recipes expansion

### v1.5.10 — 2026-05-10

- Internal docs revert.

### v1.5.9 — 2026-05-09

- Recipe picker rewritten as a compact popover (side-positioned on desktop, bottom sheet on mobile). Pastel palette + rounded corners on the by-usage energy chart.

### v1.5.8 — 2026-05-08

- New `state-trigger-light` recipe (spec 092). Recipe slots gain `crossZone` and `includeDescendants` constraints, plus a zone-first picker for single-equipment slots.

### v1.5.7 — 2026-05-08

- Power-only submeters and a by-usage energy breakdown chart (spec 091). Submeter cumulative Wh exposed as computed equipment data.

### v1.5.6 — 2026-05-03

- Per-mapping enable/disable toggle on MQTT publishers (spec 090).

### v1.5.5 — 2026-05-03

- Plugin hot-load: transitive imports cache-busted.

### v1.5.4 — 2026-05-03

- Plugin API: `getDeviceDataLastUpdated` getter exposed; `shelly_mqtt` registry bump.

### v1.5.3 — 2026-05-03

- Energy production query falls back to the hourly bucket when raw is missing. Consumption tooltip splits HP/HC into grid-only + autoconsumption.

### v1.5.2 — 2026-05-03

- Compact header pills replace the alarm banner and integration warning. Live-energy status splits by which source dominates the supply. Plugin unload always calls `stop()`.

### v1.5.1 — 2026-05-03

- Self-consumption writer (spec 086 steps E+F), plus aggregator/history bug fixes. New `getDeviceDataValue` getter for plugin baseline hydration.

### v1.5.0 — 2026-05-02

- Live power-flow page (`/energy/live`) with auto-detection of sources. Shelly MQTT plugin added to the registry. History migration tool for orphaned equipments.

---

## 1.4.x — Pool heat pump

### v1.4.2 — 2026-05-01

- Mobile dashboard renders pool heat pump like a thermostat. Disabled integrations stay visible on the Integrations page. Enable/disable toggle surfaced directly on the row.

### v1.4.1 — 2026-05-01

- Persistent Disable/Enable toggle on the integration drawer. Old `ghcr.io/mchacher/sowel` images auto-pruned after self-update.

### v1.4.0 — 2026-05-01

- New `pool_heat_pump` equipment type plus the Modbus plugin scaffolding it relies on.

---

## 1.3.x — Pool equipments

### v1.3.2 — 2026-04-19

- Alarm reminder logic moved into the Telegram notification publisher (spec 083). Theme-aware fills for the pool pump icon (dark mode). Open/Closed pill in compact shutter and pool cover cards.

### v1.3.1 — 2026-04-19

- Recipe slot layout: equal-width columns for homogeneous pairs.

### v1.3.0 — 2026-04-19

- New `pool_pump` and `pool_cover` equipment types (spec 081), with inline controls in the compact zone view and a dedicated channel picker on the device side. Multi-channel devices can now back multiple equipments. Plugin registry can be reloaded on demand from the UI.

---

## 1.2.x — Equipment dispatch v2 + domain categories

### v1.2.15 — 2026-04-19

- Tasmota plugin registered v1.0.0 (spec 080). Plugin `install()` redirects to `update()` on reinstall.

### v1.2.14 — 2026-04-18

- Devices store enum values; UI surfaces dynamic action values (spec 079). New `zone_order` button effect type with zone-first equipment selection (spec 078).

### v1.2.13 — 2026-04-18

- Refactor: `dispatchConfig`, `apiVersion`, brute-force fallback removed (spec 074). v2 dispatch is now the only path.

### v1.2.12 — 2026-04-18

- Order categories for zone-order resolution (spec 077). New outdoor temperature/humidity categories and updated `netatmo-weather` plugin (spec 076).

### v1.2.11 — 2026-04-18

- New domain categories for `media_player`, `appliance`, and `thermostat` (spec 073).

### v1.2.10 — 2026-04-18

- Thermostat zone order resolves through the setpoint category (spec 070).

### v1.2.9 — 2026-04-18

- Zone orders resolve aliases by category instead of hardcoded names (spec 069).

### v1.2.8 — 2026-04-18

- Order dispatch v2 — plugins receive `orderKey` directly instead of a `dispatchConfig` blob (spec 067).

### v1.2.7 — 2026-04-15

- Shutter zone orders use the OPEN/CLOSE state instead of a position.

### v1.2.6 — 2026-04-12

- New `onChangeOnly` option on MQTT publishers.

### v1.2.5 — 2026-04-12

- Restore snapshot on every reconnect — reverts the v1.2.4 change after side effects.

### v1.2.4 — 2026-04-12

- MQTT publishers no longer loop on snapshot when the broker reconnects; re-publish on mapping change.

### v1.2.3 — 2026-04-12

- Removed the PID file lock — it caused a Docker crash loop on container restart.

### v1.2.2 — 2026-04-12

- Internal cleanup.

### v1.2.1 — 2026-04-12

- Self-update helper container preserves the host compose `working_dir`.

### v1.2.0 — 2026-04-12

- Plugin registry decoupled from the Sowel release cadence + `sowelVersion` compatibility field (spec 066).

---

## 1.1.x — Water + freecooling

### v1.1.7 — 2026-04-12

- Update badges and buttons now use red instead of amber.

### v1.1.6 — 2026-04-12

- Internal cleanup.

### v1.1.5 — 2026-04-12

- Self-update helper container keeps `AutoRemove` off temporarily for debugging.

### v1.1.4 — 2026-04-12

- Internal cleanup.

### v1.1.3 — 2026-04-12

- Self-update pulls by version tag instead of `:latest` (avoids racing with concurrent releases).

### v1.1.2 — 2026-04-12

- New freecooling recipe — closes shutters before sunrise (spec 065).

### v1.1.1 — 2026-04-12

- Recipe packages can hot-install and hot-update without engine restart.

### v1.1.0 — 2026-04-12

- New `water_valve` equipment type (spec 062) and auto-watering recipe (spec 063).
- Computed weather data: rain-1h / rain-24h plus cumulative bar charts (spec 064).
- Timezone is now auto-derived from the home location (spec 061), with a safe fallback when the settings table is missing on a fresh install.
- Recipe UX polish, clock seconds, plugin auto-start after install/update.

---

## 1.0.x — First versioned releases

### v1.0.8 — 2026-04-11

- Internal cleanup.

### v1.0.7 — 2026-04-11

- Self-update helper container pattern + detection improvements (spec 060).

### v1.0.6 — 2026-04-11

- Internal cleanup.

### v1.0.5 — 2026-04-06

- Remote plugin registry, fetched at runtime with local fallback (spec 059).
- Docker base image switched to Debian Trixie for Python 3.13+ (Panasonic Comfort Cloud bridge compatibility).
- CI builds `amd64` only at this stage (~5 min vs ~15 min), with ARM64 added back later.
- Semver-aware comparison for plugin updates.

### v1.0.4 — 2026-04-06

- Internal cleanup.

### v1.0.3 — 2026-04-06

- Backup line-protocol export handles non-string InfluxDB values. Restore clears `recipe_log` to avoid orphan FK refs. Docker runtime keeps `python3` for the Panasonic Comfort Cloud plugin bridge.

### v1.0.2 — 2026-04-06

- Backup now includes `refresh_tokens` so a restored instance keeps users logged in.

### v1.0.1 — 2026-04-06

- Backup `PRAGMA foreign_keys` moved outside the SQLite transaction (it had no effect inside).

### v1.0.0 — 2026-04-06

- First versioned release. Adds `package.json` versioning, the Dockerfile, the GitHub Actions release pipeline, and the reference `docker-compose.yml` (spec 055). Everything before this point lives in pre-release git history only.
