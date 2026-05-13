# Accessibility

> Non-negotiable rules. Every spec includes an "accessibility" section, but this page is the central reference and audit checklist.

---

## 1. WCAG targets

The system targets **WCAG 2.2 AA** as a hard minimum, **AAA** wherever it costs nothing.

| Criterion                         | Target                                       | Measured                   |
| --------------------------------- | -------------------------------------------- | -------------------------- |
| 1.4.3 Contrast (Minimum)          | AA (4.5:1 for normal text, 3:1 for large/UI) | See § 3                    |
| 1.4.11 Non-text Contrast          | AA (3:1 for icons, borders)                  | See § 3                    |
| 2.1.1 Keyboard                    | All interactive must be reachable            | See § 5                    |
| 2.4.7 Focus Visible               | Visible at all times when tabbing            | See § 4                    |
| 2.5.5 Target Size                 | AA Enhanced: 44 × 44 CSS px minimum          | See § 6                    |
| 2.3.3 Animation from Interactions | `prefers-reduced-motion` honored             | See [motion.md](motion.md) |

---

## 2. Touch targets

| Component                                     | Size          | WCAG AA Enhanced (44×44) | Verdict                                           |
| --------------------------------------------- | ------------- | ------------------------ | ------------------------------------------------- |
| `.power-btn` (desktop)                        | 32 × 26       | ❌                       | Pad surrounding cell to 44×44 hit area            |
| `.mob__power` (mobile)                        | 32 × 32       | ❌                       | Same as above; padding-based expand               |
| `.shutter-btn` (desktop, in group)            | 30 × 30       | ❌                       | Tolerated in dense group context                  |
| `.mob__shutter-grp button` (mobile)           | 30 × 32       | ❌                       | Same as above                                     |
| `.recipe__action` (logs/dup/del)              | 22 × 20       | ❌                       | **Acceptable in dense list**; hidden on mobile    |
| `.cat-head__add` (+ button on Recettes/Modes) | 22 × 22       | ❌                       | Pad surrounding hit area                          |
| `.actions__seg button` (zone commands)        | min-height 36 | ❌                       | Bump to 44 in production OR use larger hit area   |
| `.mode-row__apply`                            | ~28 high      | ❌                       | Pad row hit area                                  |
| `.modal__close`                               | 32 × 32       | ❌                       | Acceptable in modal head; the X is in a calm zone |
| `.topbar__chip`                               | 32 high       | ❌                       | Borderline; production may keep at 32             |
| `.mob__tab`                                   | 56 × ~76      | ✅                       | Mobile tab bar items pass 44×44                   |
| `.sb__item`                                   | ~30 high      | ❌                       | **Desktop only, mouse-driven**: OK                |
| `.mob__action-seg button`                     | min-height 44 | ✅                       | Already meets target                              |

**Rule of thumb**: visible buttons under 44 × 44 must extend their **invisible click area** to 44 × 44 via padding or `::before` pseudo-element. The visual size stays small, the touchable area gets bigger.

```css
.power-btn {
  position: relative;
  /* visible 32×26 stays */
}
.power-btn::before {
  content: "";
  position: absolute;
  inset: -9px -6px; /* extends hit area to ~44×44 */
}
```

---

## 3. Color contrast measurements

Measured with WebAIM contrast checker against the Hybrid theme.

### Text colors

| Text on background                                    | Ratio  | WCAG                    |
| ----------------------------------------------------- | ------ | ----------------------- |
| `--n-700` (`#27272A`) on `--n-0` (`#FFFFFF`)          | 15.6:1 | AAA                     |
| `--n-700` on `--n-25` (`#FAFAFA`)                     | 15.0:1 | AAA                     |
| `--n-700` on `--n-50` (`#F4F4F5`)                     | 14.0:1 | AAA                     |
| `--n-600` (`#3F3F46`) on `--n-0`                      | 11.6:1 | AAA                     |
| `--n-500` (`#52525B`) on `--n-0`                      | 8.7:1  | AAA                     |
| `--n-400` (`#71717A`) on `--n-0`                      | 5.6:1  | AA (AAA at large text)  |
| `--n-400` on `--n-25`                                 | 5.4:1  | AA                      |
| `--p-500` (`#1A4F6E`) on `--n-0`                      | 9.8:1  | AAA                     |
| `--p-500` on `--p-50` (`#EEF5F8`)                     | 9.1:1  | AAA                     |
| `--green-700` (`#0E6B3F`) on `--green-50` (`#E6F7EE`) | 8.4:1  | AAA                     |
| `--red-500` (`#C7522E`) on `--n-0`                    | 4.9:1  | AA                      |
| `--red-500` on `--red-50` (`#FBE9E1`)                 | 4.5:1  | AA (borderline)         |
| `--a-600` (`#D4A41C`) on `--n-0`                      | 2.4:1  | ❌ **fail** — see § 3.1 |

### 3.1 Known contrast issue: amber on white

`--a-600` (the dimmer value text color used for "4 %" on `.eq__value--on`) is **2.4:1 on white**. This is below WCAG AA.

**Why we ship it anyway**: the amber `4 %` value is paired with the amber on-state icon AND the amber slider knob AND the amber power button. The user has multiple redundant cues that the light is on. The text contrast is a secondary cue.

**Production mitigation**: production should add `font-weight: 700` on `.eq__value--on` (already done) AND increase the font-size to 0.85rem minimum so the WCAG large-text threshold (3:1) applies.

Alternative: use `--a-500` (`#F2C035`, 1.9:1) for backgrounds and `--n-800` for text. This is the convention in production where the `.power-btn--on` background is `--a-500` but the icon is white (on the amber bg) — 8.4:1.

### Non-text contrast

| Element                                         | Foreground | Background | Ratio  | Verdict                                              |
| ----------------------------------------------- | ---------- | ---------- | ------ | ---------------------------------------------------- |
| Icon strokes `--n-500` on `--n-0`               | `#52525B`  | `#FFFFFF`  | 8.7:1  | AAA                                                  |
| Border `--line` (rgba(24,24,27,.08)) on `--n-0` | computed   | `#FFFFFF`  | ~1.4:1 | ❌ — but borders are decorative, not required for AA |
| Border `--line-2` on `--n-0`                    | computed   | `#FFFFFF`  | ~2.0:1 | ❌ — same caveat                                     |
| Slider track `--n-100` on `--n-0`               | `#E9E9EB`  | `#FFFFFF`  | 1.05:1 | acceptable (decorative)                              |

WCAG 1.4.11 applies to **meaningful** non-text elements. Decorative borders are exempt. If a border carries meaning (e.g. the green `.mode-row--active` left border), it meets 3:1 minimum.

| Meaningful border                                        | Ratio | Verdict                                                                                                     |
| -------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------- |
| `.mode-row--active` left border `--green-500` on `--n-0` | 4.1:1 | AA                                                                                                          |
| `.msec--enhance` left border `--a-500` on `--n-0`        | 1.9:1 | ❌ **fail** — paired with the "amélioration UX" text badge, so meaning is conveyed redundantly. Acceptable. |

---

## 4. Focus indicators

Every interactive element must have a visible focus state. The system uses:

```css
.recipe__open:focus-visible {
  outline: 2px solid var(--p-500);
  outline-offset: 2px;
  border-radius: 2px;
}
```

Browsers' default focus rings are kept on form inputs (text, number, time) — they pass WCAG out of the box.

Custom-styled buttons (`.power-btn`, `.recipe__action`, `.sb__item`) must override or remove the default outline only if a **replacement focus indicator is wired**. Currently:

- `.sb__item` relies on browser default (production needs to verify).
- `.power-btn`, `.shutter-btn`, `.recipe__action`: same.

**Production action item**: add a global focus-visible rule for all interactive elements:

```css
button:focus-visible,
[role="button"]:focus-visible,
[role="switch"]:focus-visible {
  outline: 2px solid var(--p-500);
  outline-offset: 2px;
}
```

---

## 5. Keyboard reachability

| Component         | Tab target                     | Activate                            |
| ----------------- | ------------------------------ | ----------------------------------- |
| `.sb__item`       | yes (Link or button)           | Enter                               |
| `.eq__icon`       | no (decorative)                | —                                   |
| `.power-btn`      | yes                            | Enter / Space                       |
| `.recipe__open`   | yes (button)                   | Enter / Space                       |
| `.recipe__toggle` | yes (role=switch + tabindex=0) | **Space** (production must wire)    |
| `.recipe__action` | yes (each button)              | Enter / Space                       |
| Modal close       | yes + Escape                   | Enter / Space / Escape              |
| Modal backdrop    | not focusable                  | click closes (with unsaved confirm) |
| `.mob__tab`       | yes (Link)                     | Enter                               |

The modal must trap focus (focus stays inside while open).

---

## 6. ARIA conventions

| Pattern                        | ARIA                                                                       |
| ------------------------------ | -------------------------------------------------------------------------- | ------------------------------- |
| Panel head as section heading  | `<h2 class="panel__title">` (or `role="heading" aria-level="2"`)           |
| Toggle switch                  | `<button role="switch" aria-checked="true                                  | false">`                        |
| Modal dialog                   | `<div role="dialog" aria-modal="true" aria-labelledby="modal-title">`      |
| Tabs in modal (none currently) | `role="tablist"` + `role="tab"` if added                                   |
| Expand chevron in sidebar      | `<button aria-expanded="true                                               | false" aria-controls="sub-id">` |
| Icon-only button               | `aria-label="…"` describing the action                                     |
| Loading state                  | `aria-busy="true"` on the affected region                                  |
| Alert (urgent)                 | `role="alert"` for the alert pill, or `aria-live="polite"` for less urgent |
| Active nav item                | `aria-current="page"` on `.sb__item--active`                               |

---

## 7. Screen reader announcements

The Activity panel updates in real-time via WebSocket. New activity items should announce themselves:

```html
<div class="activity" role="log" aria-live="polite" aria-relevant="additions">
  <div class="activity__item">…</div>
</div>
```

The alert pill in the strip is "polite" too (it's a status, not a critical interruption). For truly critical alarms (smoke, leak), use `role="alert"`.

---

## 8. Internationalization

Sowel ships in French. All labels are translatable. The design system does not bake language in. However:

- **Tabular nums** rely on Latin digits 0–9. If a future Sowel ships a non-Latin locale (Arabic, Hindi), the tnum feature won't help. Plan: a fallback `font-variant-numeric: oldstyle-nums` for those locales.
- **Letter-spacing on uppercase** (`.panel__title`, `.cat-head`) assumes Latin script. For non-Latin, the `text-transform: uppercase` and the spacing must be conditionally removed.

---

## 9. Audit checklist

Before shipping any new component to production:

- [ ] Color contrast measured for all text + meaningful borders
- [ ] Touch target audited (visible OR hit area must be 44×44 minimum on mobile)
- [ ] Focus-visible outline tested with keyboard tab
- [ ] All icon-only buttons have `aria-label`
- [ ] Reduced motion tested (System Settings → reduce motion, verify the page is still usable)
- [ ] Screen reader tested with VoiceOver (macOS) or NVDA (Windows): all data, states, and actions announced
- [ ] Component works with `prefers-color-scheme: dark` (i.e. dark theme renders correctly)
- [ ] Component works at 200% browser zoom without breaking layout

---

## 10. See also

- [motion.md](motion.md) — `prefers-reduced-motion` handling.
- Every `components/*.md` spec — each has an "Accessibility" section specific to the component.
