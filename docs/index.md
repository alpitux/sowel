---
hide:
  - navigation
  - toc
---

<div class="sowel-hero sowel-hero--split">
<div class="sowel-hero__copy">

<p class="sowel-hero__eyebrow">A different way to automate your home</p>

<h1 class="sowel-hero__tagline">Don't program your home.<br/><em>Apply recipes to it.</em></h1>

<p class="sowel-hero__lead">Sowel is a home automation engine that thinks in rooms, modes and recipes — not in YAML files. Pick a recipe, drop it on a zone, and your house works.</p>

<p class="sowel-hero__ctas">
  <a class="md-button md-button--primary" href="user/getting-started/">Get started <span class="md-icon md-icon--arrow">→</span></a>
  <a class="md-button" href="user/">Read the user guide</a>
  <a class="sowel-hero__ghost" href="https://github.com/mchacher/sowel/blob/main/plugins/registry.json">Browse 23 plugins →</a>
</p>

<p class="sowel-hero__badges">
  <span class="sowel-badge sowel-badge--ok">No cloud, no telemetry</span>
  <span class="sowel-badge">Multi-arch · Raspberry Pi-ready</span>
  <span class="sowel-badge">AGPL-3.0 · v1.5.10</span>
</p>

</div>
<div class="sowel-hero__mock-wrap">

<div class="sowel-mock" aria-hidden="true">
  <div class="sowel-mock__title">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
    <span class="sowel-mock__zone">Living Room</span>
    <span class="sowel-mock__mode">Lumière soir</span>
  </div>
  <div class="sowel-mock__metrics">
    <div class="sowel-mock__metric"><div class="sowel-mock__metric-label">Lux</div><div class="sowel-mock__metric-value">334</div></div>
    <div class="sowel-mock__metric sowel-mock__metric--motion"><div class="sowel-mock__metric-label">Motion</div><div class="sowel-mock__metric-value">Calm</div></div>
    <div class="sowel-mock__metric sowel-mock__metric--lights"><div class="sowel-mock__metric-label">Lights</div><div class="sowel-mock__metric-value">1/3</div></div>
    <div class="sowel-mock__metric"><div class="sowel-mock__metric-label">Shutters</div><div class="sowel-mock__metric-value">0/3</div></div>
  </div>
  <div class="sowel-mock__cards">
    <div class="sowel-mock__card sowel-mock__card--on">
      <span class="sowel-mock__card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6M10 22h4"/></svg></span>
      <span class="sowel-mock__card-title">Appliques x2</span>
      <span class="sowel-mock__card-state sowel-mock__card-state--dim">Dim 4%</span>
    </div>
    <div class="sowel-mock__card sowel-mock__card--shutter">
      <span class="sowel-mock__card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18"/></svg></span>
      <span class="sowel-mock__card-title">Shutters South</span>
      <span class="sowel-mock__card-state sowel-mock__card-state--closed">Closed</span>
    </div>
  </div>
  <div class="sowel-mock__recipe">
    <b>● Motion Light</b> — keeps lights at 4% until 06:14, then ramps up
  </div>
</div>

</div>
</div>

<div class="sowel-section">

<p class="sowel-eyebrow">A different way to automate your home</p>

<p class="sowel-paragraph">Most home automation tools turn you into a part-time developer: YAML files, scripts, flows, conditions, edge cases. The result is fragile spaghetti that only one person in the household can debug.</p>

<p class="sowel-paragraph"><strong>Sowel takes the opposite path.</strong> Instead of writing automations, you <strong>pick a recipe</strong> (<em>Motion Light</em>, <em>Presence Thermostat</em>, <em>Pool Pump Schedule</em>, <em>Sunset Shutters</em>) and <strong>apply it to a zone</strong>. Each recipe encodes a thoughtful, road-tested pattern that strikes the right balance between comfort, safety, and energy efficiency. You configure a few obvious settings (a duration, a temperature, a time window), not a programming language.</p>

<p class="sowel-paragraph">The best automation is the one you forget about. Your home just works.</p>

</div>

<div class="sowel-section">

<div class="sowel-story">

<p class="sowel-eyebrow">A small story</p>

<p class="sowel-paragraph">Take <em>Constant Light</em>. A kitchen lit at a comfortable brightness all day. To do it right you need several motion sensors that extend the same timer without fighting each other, a brightness target that bends with the natural lux coming in through the window, and exemptions for meals, nighttime, or when someone hits the switch.</p>

<p class="sowel-paragraph">Or take <em>Solar EV Charging</em>. The charger should ramp up exactly as fast as your panels are producing surplus, and back off the moment a cloud passes or the dishwasher turns on. The arithmetic is one line; the orchestration is not.</p>

<ul class="sowel-bullets">
  <li>multiple inputs that have to stay in sync (sensors, meters, schedules)</li>
  <li>real-time decisions that follow live measurements, not snapshots</li>
  <li>safe fallbacks for every edge case (sensor offline, network hiccup, user override)</li>
</ul>

<p class="sowel-paragraph">Each rule on its own is trivial. The hard part is the <strong>combinations</strong>. IFTTT-style rules fall apart on the first overlap. Hand-built automations get debugged for a week, then quietly accumulate corner cases nobody dares touch.</p>

<p class="sowel-paragraph"><strong>Sowel encodes this complexity once</strong>, road-tested, and ships it as a recipe. Drop it on a zone and move on.</p>

</div>

</div>

<div class="sowel-section">

<p class="sowel-eyebrow">Where every other home automation tool sees triggers, Sowel sees a home.</p>

<p class="sowel-paragraph">Most tools start at the wires and ask you to bolt scripts on top. Sowel starts at the home and lets the wires fall into place. Five layers describe your house in the same words you'd use yourself, each one a little less abstract than the one below it:</p>

<ul class="sowel-bullets">
  <li><strong>Devices</strong> are auto-discovered and normalized into one data model.</li>
  <li><strong>Equipments</strong> name what those devices actually do.</li>
  <li><strong>Zones</strong> group equipments by space, with auto-aggregated metrics.</li>
  <li><strong>Modes</strong> flip the whole house in one tap.</li>
  <li><strong>Recipes</strong> make it run on its own.</li>
</ul>

<p class="sowel-paragraph">And the cherry on top:</p>

<ul class="sowel-bullets">
  <li>Integrations and recipes ship as <strong>plugins</strong>, distributed from GitHub: <em>Zigbee2MQTT</em>, <em>Netatmo</em>, <em>Shelly</em>, <em>Panasonic Comfort Cloud</em>, <em>weather forecasts</em>, and many more. Install what you need, ignore the rest.</li>
  <li>Everything sits on a small, typed <strong>API and event bus</strong>, so extending Sowel is a single TypeScript file, not a fork.</li>
</ul>

<div class="sowel-cards">

<div class="sowel-card">
  <div class="sowel-card__icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 9h2"/><path d="M20 15h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>
  </div>
  <h3>Devices. What's on your network.</h3>
  <p class="sowel-card__lead">Whatever the brand, whatever the protocol, Sowel models them all the same way.</p>
  <p>About fifty semantic categories match what a home actually measures: temperature, motion, brightness, contact, energy, water, presence. Each integration plugin (Zigbee, MQTT, a cloud API, a LoRa bridge) translates its raw protocol into that shared vocabulary, so every device lands with the right category, type, and unit, ready to bind.</p>
  <p class="sowel-card__example" data-label="Example">A Zigbee bulb, a Shelly relay, and a Netatmo station all expose <em>temperature</em> the same way — same category, same unit, same equipment binding.</p>
  <p class="sowel-card__more"><a href="user/devices/">Read more →</a></p>
</div>

<div class="sowel-card">
  <div class="sowel-card__icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  </div>
  <h3>Equipments. What's in your room.</h3>
  <p class="sowel-card__lead">Sowel standardizes the things every home has — lights, shutters, thermostats, sensors, gates, meters.</p>
  <p>Each equipment has a known type, a name, and a predictable set of controls. Bind one device or several — three IKEA dimmers behind a wall, a Zigbee bulb, a cloud-driven heat pump — and Sowel hides the wiring behind a single handle you can use, group, and reason about.</p>
  <p class="sowel-card__example" data-label="Example">A wall dimmer and the ceiling spots it controls become a single <em>Kitchen Lights</em> equipment you can dim from one place.</p>
  <p class="sowel-card__more"><a href="user/equipments/">Read more →</a></p>
</div>

<div class="sowel-card">
  <div class="sowel-card__icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
  </div>
  <h3>Zones. Your home's topology.</h3>
  <p class="sowel-card__lead">Sowel turns your layout into a thinking map of your house.</p>
  <p>Group equipments into zones, by room, by floor, by purpose. Sowel rolls up their data automatically — averages, OR-of-all, max — so a zone always knows its own state. No formulas, no glue code, no dashboards to wire.</p>
  <p class="sowel-card__example" data-label="Example">Three PIR sensors in your <em>Living Room</em> zone become a single presence signal — anyone moves anywhere, the zone is occupied.</p>
  <p class="sowel-card__more"><a href="user/zones/">Read more →</a></p>
</div>

<div class="sowel-card">
  <div class="sowel-card__icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
  </div>
  <h3>Modes. Your home's rhythms.</h3>
  <p class="sowel-card__lead">Sowel makes the whole house move in tune with your habits.</p>
  <p>Define modes for the rhythms you live by — Day, Evening, Night. One tap (or a schedule) flips every zone over: brightness targets, motion behaviour, heating setpoints, recipes on or off.</p>
  <p class="sowel-card__example" data-label="Example">At sunset your home switches to <em>Evening</em> — dimmers drop to 40%, lights warm up, and the kids' rooms stop reacting to motion.</p>
  <p class="sowel-card__more"><a href="user/modes/">Read more →</a></p>
</div>

<div class="sowel-card">
  <div class="sowel-card__icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.46.32-.84.73-1.04a4 4 0 0 0-2.13-7.59 5 5 0 0 0-9.2 0 4 4 0 0 0-2.13 7.59c.41.2.73.58.73 1.04V20a1 1 0 0 0 1 1z"/><path d="M6 17h12"/></svg>
  </div>
  <h3>Recipes. Your home's reflexes.</h3>
  <p class="sowel-card__lead">Sowel ships them tested. Drop one on a zone, no scripting.</p>
  <p>Choose from a curated catalogue: motion-triggered lighting, presence-based heating, scheduled irrigation, sunset shutters. Set a few values, and it runs. No flows to wire, no logic programming.</p>
  <p class="sowel-card__example" data-label="Example">The <em>Motion Light (Dimmable)</em> recipe keeps a room at the right brightness whenever someone's there — vivid by day, gentle in the evening, dim at night. One recipe, three modes, zero code.</p>
  <p class="sowel-card__more"><a href="user/recipes/">Read more →</a></p>
</div>

</div>

</div>

<div class="sowel-section sowel-section--feature">

<p class="sowel-eyebrow">Deploy in minutes. Yours from day one.</p>

<div class="sowel-pills">
  <div class="sowel-pill">
    <strong>One command.</strong> <code>curl ... | sh</code> on any Docker host — Linux, macOS, Raspberry Pi. Sowel and InfluxDB up in under a minute.
  </div>
  <div class="sowel-pill">
    <strong>Stays at home.</strong> No cloud, no telemetry, no third-party account. Your data lives on your hardware: a Raspberry Pi, an old PC, a Proxmox VM, whatever you've got lying around.
  </div>
  <div class="sowel-pill">
    <strong>Plug in what you own.</strong> Zigbee, Panasonic, Netatmo, Shelly, Legrand, MQTT-anything. Install integrations like you install apps, skip what you don't need.
  </div>
  <div class="sowel-pill">
    <strong>Self-updating.</strong> Plugins and the engine update from GitHub. No SSH, no fiddling, no reboots scheduled at 3 a.m.
  </div>
</div>

</div>

<div class="sowel-section">

<p class="sowel-eyebrow">Take a tour</p>

<div class="sowel-cards sowel-cards--two">

<div class="sowel-card">
  <div class="sowel-card__icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
  </div>
  <h3>For users</h3>
  <p>Set up your home, configure equipments, and apply your first recipes.</p>
  <p><a href="user/getting-started/">User guide →</a></p>
</div>

<div class="sowel-card">
  <div class="sowel-card__icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z"/></svg>
  </div>
  <h3>For developers</h3>
  <p>Architecture, plugin development, recipes, and the data model.</p>
  <p><a href="technical/">Technical guide →</a></p>
</div>

</div>

</div>

<p class="sowel-foot">Sowel is licensed under <a href="https://github.com/mchacher/sowel/blob/main/LICENSE">AGPL-3.0</a> · <a href="https://github.com/mchacher/sowel">GitHub</a></p>
