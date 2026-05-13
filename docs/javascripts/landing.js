/*
 * Sowel landing — scroll-driven reveal animations.
 * Wires IntersectionObserver to elements that should fade-up when they
 * enter the viewport. CSS does the actual transition (see .sowel-reveal
 * in stylesheets/extra.css); this file only:
 *   1. tags the relevant elements with .sowel-reveal
 *   2. sets a --sowel-i index per child for staggered timing
 *   3. flips .is-visible once they intersect
 *
 * No-op when:
 *   - the page has no hero split (i.e. not the landing)
 *   - the user prefers reduced motion
 *   - IntersectionObserver is unavailable
 */
(function () {
  "use strict";

  function init() {
    var hero = document.querySelector(".sowel-hero--split");
    if (!hero) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    // Stagger index for children of these groups
    var groups = document.querySelectorAll(
      ".sowel-cards, .sowel-pills, .sowel-bullets, .sowel-hero__badges",
    );
    groups.forEach(function (group) {
      var i = 0;
      Array.prototype.forEach.call(group.children, function (child) {
        child.style.setProperty("--sowel-i", i++);
      });
    });

    // Elements to reveal on scroll
    var targets = document.querySelectorAll(
      ".sowel-section, .sowel-card, .sowel-pill, .sowel-bullets li, .sowel-story",
    );
    targets.forEach(function (el) {
      el.classList.add("sowel-reveal");
    });

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" },
    );

    document.querySelectorAll(".sowel-reveal").forEach(function (el) {
      io.observe(el);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
