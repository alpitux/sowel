/*
 * Sowel landing — horizontal "flipbook" scroll.
 *
 * The DOM layout is:
 *   .sowel-flip                  (outer, height = N * 100vh)
 *     .sowel-flip__pin           (position: sticky)
 *       .sowel-flip__track       (display: flex, width = N * 100vw)
 *         .sowel-flip__page * N
 *
 * The user scrolls VERTICALLY. We read the outer container's scroll
 * progress and translate the inner track horizontally, so it feels
 * like flipping pages of a book. CSS provides the static layout and
 * the mobile / reduced-motion fallback (track becomes a vertical stack).
 *
 * Also injects a small set of dots fixed to the bottom-right that
 * indicates the current page and lets the user jump to a page.
 */
(function () {
  "use strict";

  function init() {
    var flip = document.querySelector(".sowel-flip");
    if (!flip) return;
    var pin = flip.querySelector(".sowel-flip__pin");
    var track = flip.querySelector(".sowel-flip__track");
    if (!pin || !track) return;

    var pages = track.querySelectorAll(".sowel-flip__page");
    var n = pages.length;
    if (n < 2) return;

    // Tell CSS how many pages we have (used by .sowel-flip height + track width).
    flip.style.setProperty("--sowel-flip-n", String(n));

    // Disabled paths: small viewports + reduced motion.
    var mqSmall = window.matchMedia("(max-width: 899px)");
    var mqReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    function isDisabled() {
      return mqSmall.matches || mqReduced.matches;
    }

    // === Page indicator (dots) ==========================================
    var dots = document.createElement("div");
    dots.className = "sowel-flip__dots";
    dots.setAttribute("role", "tablist");
    dots.setAttribute("aria-label", "Page indicator");
    var dotEls = [];
    for (var i = 0; i < n; i++) {
      var b = document.createElement("button");
      b.className = "sowel-flip__dot";
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-label", "Go to page " + (i + 1));
      (function (idx) {
        b.addEventListener("click", function () {
          goTo(idx);
        });
      })(i);
      dots.appendChild(b);
      dotEls.push(b);
    }
    document.body.appendChild(dots);

    function setActiveDot(idx) {
      for (var i = 0; i < dotEls.length; i++) {
        if (i === idx) dotEls[i].setAttribute("aria-current", "true");
        else dotEls[i].removeAttribute("aria-current");
      }
    }

    // === Scroll → translateX ============================================
    function update() {
      if (isDisabled()) {
        track.style.transform = "";
        setActiveDot(-1);
        return;
      }
      var rect = flip.getBoundingClientRect();
      var scrolled = Math.max(0, -rect.top);
      var max = flip.offsetHeight - window.innerHeight;
      if (max <= 0) {
        track.style.transform = "translateX(0)";
        setActiveDot(0);
        return;
      }
      var progress = Math.min(1, scrolled / max);
      // 0..1 progress maps to 0..(n-1) page width in vw
      var translate = progress * (n - 1) * 100;
      track.style.transform = "translateX(-" + translate + "vw)";

      // Nearest page wins the dot highlight
      var current = Math.round(progress * (n - 1));
      setActiveDot(current);
    }

    function goTo(idx) {
      if (isDisabled()) {
        // Fallback: scroll the page into view in stacked layout
        var target = pages[idx];
        if (target && target.scrollIntoView) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        return;
      }
      var max = flip.offsetHeight - window.innerHeight;
      var offset = flip.getBoundingClientRect().top + window.scrollY;
      var targetY = offset + (idx / (n - 1)) * max;
      window.scrollTo({ top: targetY, behavior: "smooth" });
    }

    // === Keyboard nav: Left/Right + PageUp/PageDown ======================
    window.addEventListener("keydown", function (e) {
      if (isDisabled()) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var rect = flip.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= window.innerHeight) return;
      var max = flip.offsetHeight - window.innerHeight;
      var progress = Math.min(1, Math.max(0, -rect.top / max));
      var current = Math.round(progress * (n - 1));
      var next = null;
      if (e.key === "ArrowRight" || e.key === "PageDown") next = current + 1;
      else if (e.key === "ArrowLeft" || e.key === "PageUp") next = current - 1;
      if (next === null) return;
      next = Math.min(n - 1, Math.max(0, next));
      if (next !== current) {
        e.preventDefault();
        goTo(next);
      }
    });

    var rafPending = false;
    function onScroll() {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(function () {
        rafPending = false;
        update();
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", update);
    mqSmall.addEventListener && mqSmall.addEventListener("change", update);
    mqReduced.addEventListener && mqReduced.addEventListener("change", update);
    update();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
