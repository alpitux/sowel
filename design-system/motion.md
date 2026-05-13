# Motion

> One orchestrated reveal at first paint. A few rare, semantic micro-animations after that. No scattered micro-interactions.

This document codifies the motion principles that emerged in the polished UI. It follows the Anthropic frontend-design skill recommendation:

> "Focus on high-impact moments: one well-orchestrated page load with staggered reveals creates more delight than scattered micro-interactions."

---

## 1. Principles

1. **One signature motion per page**, applied on first paint: the **`rise` cascade**. After that, the page is still.
2. **Semantic micro-animations only**: a glow on lights that are on. A pulse on alert pills. A ping on the Connecté dot. Each animation says one thing.
3. **No hover animations beyond simple color/bg transitions** (140–240 ms). Hover is a cursor signal, not entertainment.
4. **Honor `prefers-reduced-motion`**: every animation is overridable. The page must remain fully functional with zero motion.

---

## 2. Tokens

### Durations

| Use                                    | Duration         | Easing                        |
| -------------------------------------- | ---------------- | ----------------------------- |
| Color / background transition (hover)  | 140 ms           | default (browser)             |
| Theme switch transition (palette flip) | 240 ms           | ease                          |
| Reveal cascade (`rise`)                | 520 ms           | `cubic-bezier(.2, .7, .2, 1)` |
| Glow pulse (`glow`)                    | 3200 ms infinite | ease-in-out                   |
| Alert pulse (`pulseAlert`)             | 1600 ms infinite | ease-in-out                   |
| Connected ping (`connPing`)            | 1800 ms infinite | linear                        |

### Easings

All scripted reveals use `cubic-bezier(.2, .7, .2, 1)` — gentle, slightly overshooting toward the end. This is the **only** custom easing in the system. All transitions on hover use the browser default.

---

## 3. The `rise` cascade (signature)

A staggered fade + translate, applied once at first paint to the top-level scaffolding:

```css
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.ui .topbar {
  animation: rise 520ms cubic-bezier(0.2, 0.7, 0.2, 1) backwards;
  animation-delay: 0ms;
}
.ui .hero {
  animation: rise 520ms cubic-bezier(0.2, 0.7, 0.2, 1) backwards;
  animation-delay: 80ms;
}
.ui .actions {
  animation: rise 520ms cubic-bezier(0.2, 0.7, 0.2, 1) backwards;
  animation-delay: 160ms;
}
.ui .grid {
  animation: rise 520ms cubic-bezier(0.2, 0.7, 0.2, 1) backwards;
  animation-delay: 220ms;
}

/* Mobile cascade */
.mob__topbar {
  animation: rise 480ms cubic-bezier(0.2, 0.7, 0.2, 1) backwards;
  animation-delay: 60ms;
}
.mob__hero {
  animation: rise 480ms cubic-bezier(0.2, 0.7, 0.2, 1) backwards;
  animation-delay: 120ms;
}
.mob__actions {
  animation: rise 480ms cubic-bezier(0.2, 0.7, 0.2, 1) backwards;
  animation-delay: 180ms;
}
.mob__panel {
  animation: rise 480ms cubic-bezier(0.2, 0.7, 0.2, 1) backwards;
  animation-delay: 240ms;
}
```

**Total perceived load duration**: ~740 ms (last element finishes at 220 + 520 = 740 ms). Fast enough to feel instant, long enough to feel deliberate.

The animation uses `animation-fill-mode: backwards` so the initial opacity-0 state is applied even before the animation starts — prevents flicker.

---

## 4. Semantic micro-animations

These have a meaning. They are infinite (loop) but quiet enough to be peripheral.

### 4.1 `glow` — light is on

```css
@keyframes glow {
  0%,
  100% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--a-500) 30%, transparent);
  }
  50% {
    box-shadow: 0 0 0 5px color-mix(in srgb, var(--a-500) 14%, transparent);
  }
}
.eq__icon--light-on,
.mob__eq-icon--light-on {
  animation: glow 3.2s ease-in-out infinite;
}
```

**Meaning**: the amber light icon ripples gently. It's the single accent moment of the UI — reserved for "a real light is on right now". Slow cadence (3.2 s) so it's noticeable but never distracting.

### 4.2 `pulseAlert` — alert pill

```css
@keyframes pulseAlert {
  0%,
  100% {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--red-500) 25%, transparent);
  }
  50% {
    box-shadow: 0 0 0 6px color-mix(in srgb, var(--red-500) 8%, transparent);
  }
}
.strip__pill--alert::before,
.mob__pill--alert::before {
  animation: pulseAlert 1.6s ease-in-out infinite;
}
```

**Meaning**: a door is open, a leak is detected, etc. Faster cadence (1.6 s) — it's urgent enough to draw the eye but not panic.

### 4.3 `connPing` — connection alive

```css
@keyframes connPing {
  0% {
    transform: scale(1);
    opacity: 0.6;
  }
  100% {
    transform: scale(2.4);
    opacity: 0;
  }
}
.topbar__conn--connected .topbar__conn-dot::after,
.mob__conn-dot::after {
  animation: connPing 1.8s ease-in-out infinite;
  background: var(--green-500);
  opacity: 0.6;
}
```

**Meaning**: the green ring expands outward from the dot, fading. Confirms the WebSocket connection is alive without sitting still like a static badge.

---

## 5. Hover / state transitions

Plain CSS transitions, no keyframes:

```css
.sb__item {
  transition:
    background-color 140ms,
    color 140ms;
}
.recipe__action {
  transition:
    background-color 140ms,
    color 140ms;
}
.eq__icon,
.sb__item-icon {
  transition:
    opacity 140ms,
    color 140ms;
}

* {
  transition:
    background-color 240ms ease,
    color 240ms ease,
    border-color 240ms ease;
}
```

The global 240 ms transition on every element exists **only to soften the theme switch** (Hybrid → Dark). It is not for hover delight. Hover-specific transitions override with 140 ms.

---

## 6. `prefers-reduced-motion`

Per the WCAG SC 2.3.3 (Animation from Interactions), users who request reduced motion must get a static page.

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Targeted overrides for clarity */
@media (prefers-reduced-motion: reduce) {
  .eq__icon--light-on {
    animation: none;
  }
  .strip__pill--alert::before {
    animation: none;
  }
  .topbar__conn--connected .topbar__conn-dot::after {
    animation: none;
  }
}
```

The blanket rule covers everything. The targeted overrides exist purely for code readability — they tell a future reader "these specific animations are intentional and they stop with the user setting".

**Test path**: macOS System Preferences → Accessibility → Display → "Reduce motion". Then reload the page. Nothing should pulse, glow, or rise. The page should appear instantly with all elements in their final state.

---

## 7. Anti-patterns

Avoid in the Sowel system:

- ❌ Hover animations that scale, translate, or transform elements. Only color/bg shifts.
- ❌ Page transition animations (route changes). Sowel uses instant cuts.
- ❌ Loading spinners on top of existing data. Use a subtle opacity dimming or a sparkline skeleton instead.
- ❌ Decorative parallax, scroll-triggered effects, mouse-following gradients. These belong in marketing sites, not control interfaces.
- ❌ Re-using `rise` on user interaction (clicking a tab, opening a modal). The cascade is for first paint only.
- ❌ More than one infinite animation per surface. If a zone has both lights on AND an alert, both animations run, but no third animation is added on top.

---

## 8. Production wiring notes

When porting to React:

- **Don't** put the `rise` keyframes inside a component CSS module. Keep them in the global `tokens.css` so the cascade is consistent across pages.
- **Do** trigger the animation by class application on mount, not on prop changes. Use `<div className="topbar">…</div>` — React's mount IS the trigger.
- **Don't** memoize the cascade. It runs once per page mount; no performance concern.

---

## 9. See also

- [tokens.css](tokens.css) — All keyframes live here.
- [accessibility.md](accessibility.md) — Reduced motion is one of the WCAG checks.
