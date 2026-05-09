---
hide:
  - navigation
  - toc
---

<div class="sowel-hero">

<svg class="sowel-logo" xmlns="http://www.w3.org/2000/svg" viewBox="25 15 150 155" aria-label="Sowel logo">
  <path class="house"     d="M100 30 L160 90 Q165 95 160 100 L160 150 Q160 158 152 158 L48 158 Q40 158 40 150 L40 100 Q35 95 40 90 Z"/>
  <path class="smile"     d="M75 115 Q100 140 125 115"/>
  <path class="left-eye"  d="M78 95 Q83 87 88 95"/>
  <path class="right-eye" d="M112 95 Q117 87 122 95"/>
</svg>

<h1 class="sowel-wordmark">Sowel</h1>

<p class="sowel-lede"><strong>Don't program your home. <em>Apply recipes to it.</em></strong><br/>
A home automation engine for <em>comfort</em>, <em>safety</em> and <em>energy efficiency</em>, without writing a single line of code.</p>

<p class="sowel-cta">
  <a class="md-button md-button--primary" href="user/getting-started/">Get started <span class="md-icon md-icon--arrow">→</span></a>
  <a class="md-button" href="https://github.com/mchacher/sowel">See it on GitHub</a>
</p>

</div>

<div class="sowel-section">

<p class="sowel-eyebrow">A different way to automate your home</p>

<p class="sowel-paragraph">Most home automation tools turn you into a part-time developer: YAML files, scripts, flows, conditions, edge cases. The result is fragile spaghetti that only one person in the household can debug.</p>

<p class="sowel-paragraph"><strong>Sowel takes the opposite path.</strong> Instead of writing automations, you <strong>pick a recipe</strong> (<em>Motion Light</em>, <em>Presence Thermostat</em>, <em>Pool Pump Schedule</em>, <em>Sunset Shutters</em>) and <strong>apply it to a zone</strong>. Each recipe encodes a thoughtful, road-tested pattern for a specific need: comfort, safety, or energy efficiency. You configure a few obvious settings (a duration, a temperature, a time window), not a programming language.</p>

<p class="sowel-paragraph">Your house stops being a side project. It just works.</p>

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

<p class="sowel-eyebrow">What makes Sowel singular</p>

<p class="sowel-paragraph">Sowel layers your home from the network up:</p>

<ul class="sowel-bullets">
  <li><strong>Devices</strong> are auto-discovered and normalized into one data model.</li>
  <li><strong>Equipments</strong> name what those devices actually do.</li>
  <li><strong>Zones</strong> group equipments by space, with auto-aggregated metrics.</li>
  <li><strong>Modes</strong> flip the whole house in one tap.</li>
  <li><strong>Recipes</strong> make it run on its own.</li>
</ul>

<p class="sowel-paragraph">And the cherry on top:</p>

<ul class="sowel-bullets">
  <li>Integrations and recipes ship as <strong>first-class plugins</strong>, distributed from GitHub: <em>Zigbee2MQTT</em>, <em>Netatmo</em>, <em>Shelly</em>, <em>Panasonic Comfort Cloud</em>, <em>weather forecasts</em>, and many more. Install what you need, ignore the rest.</li>
  <li>Everything sits on a small, typed <strong>API and event bus</strong>, so extending Sowel is a single TypeScript file, not a fork.</li>
</ul>

<div class="sowel-cards">

<div class="sowel-card">
  <div class="sowel-card__icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  </div>
  <h3>Equipments. A standard vocabulary for your home.</h3>
  <p>Sowel turns the wiring of your house into a small, well-defined catalogue: lights, shutters, thermostats, motion sensors, energy meters. Three switches and a motion sensor in your kitchen become one <em>Kitchen Lights</em> equipment, something you can name, group, and reason about.</p>
</div>

<div class="sowel-card">
  <div class="sowel-card__icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
  </div>
  <h3>Zones that aggregate themselves</h3>
  <p>Group equipments into zones, by room, by floor, by purpose. A zone called <em>Ground Floor</em> tells you the average temperature, the brightest room, the highest humidity, automatically. No formulas, no glue code, no dashboards to wire.</p>
</div>

<div class="sowel-card">
  <div class="sowel-card__icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
  </div>
  <h3>Modes that switch the whole house</h3>
  <p>Day, Night, Holiday, Cocoon. One tap flips your home over: dimmer lights, lower thermostats, closed shutters. Schedule them or trigger them by hand.</p>
</div>

<div class="sowel-card">
  <div class="sowel-card__icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.46.32-.84.73-1.04a4 4 0 0 0-2.13-7.59 5 5 0 0 0-9.2 0 4 4 0 0 0-2.13 7.59c.41.2.73.58.73 1.04V20a1 1 0 0 0 1 1z"/><path d="M6 17h12"/></svg>
  </div>
  <h3>Recipes, not scripts</h3>
  <p>Drop a curated automation pattern onto a zone (motion-triggered lighting, presence-based heating, scheduled irrigation, sunset shutters), set a few values, and it runs. No flows to wire. No logic programming.</p>
</div>

</div>

</div>

<div class="sowel-section">

<p class="sowel-eyebrow">Deploy in minutes. Yours from day one.</p>

<div class="sowel-pills">
  <div class="sowel-pill">
    <strong>One Docker container.</strong> <code>docker compose up -d</code>. That's the install.
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
  <h3>For builders</h3>
  <p>Architecture, plugin development, recipes, and the data model.</p>
  <p><a href="technical/">Technical guide →</a></p>
</div>

</div>

</div>

<p class="sowel-foot">Sowel is licensed under <a href="https://github.com/mchacher/sowel/blob/main/LICENSE">AGPL-3.0</a> · <a href="https://github.com/mchacher/sowel">GitHub</a></p>
