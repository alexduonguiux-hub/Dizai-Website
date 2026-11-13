/* Contact (Figma 10:1546): everything rolls in when the page opens, the
   same letters-rising move as the rest of the site (assets/js/roll.js);
   the "đs" mark rises with them. Going to
   another page of the site, it all rolls away first. */
(function () {
  "use strict";
  var root = document.documentElement;
  var Roll = window.DzRoll, gsap = window.gsap;
  function done() { root.classList.remove("is-entering"); }
  if (!Roll || !gsap) return done();

  var q = function (s) { return [].slice.call(document.querySelectorAll(s)); };
  // in the order they come in: the middle first, then the frame around it
  // (not the menu: it stays as it is from page to page)
  var texts = [".cp-kicker", ".cp-email", ".cp-social", ".cp-info", ".cp-copy"]
    .reduce(function (all, s) { return all.concat(q(s)); }, [])
    .filter(function (el) { return el.getClientRects().length; });
  var boxes = [".cp-mark"].reduce(function (all, s) { return all.concat(q(s)); }, []);
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // from Work / About the mark was already here: it stays and turns over
  var keepMark = Roll.takeFlip && Roll.takeFlip();
  function enter() {
    var rs = texts.map(function (el) { var r = Roll.text(el, "in"); r.set(0); return r; })
      .concat(keepMark ? [] : boxes.map(function (el) { var r = Roll.box(el, "in"); r.set(0); return r; }));
    done();
    if (keepMark) Roll.flip(boxes);
    if (reduce) { rs.forEach(function (r) { r.set(1); }); return; }
    rs.forEach(function (r, i) {
      var o = { v: 0 };
      gsap.to(o, { v: 1, duration: 0.8, delay: 0.1 + i * 0.07 + (window.DzRoll && DzRoll.wait ? DzRoll.wait() : 0), ease: "none",
                   onUpdate: function () { r.set(o.v); } });
    });
  }
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(enter);

  // going to the rest of the site: roll away first
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    var url = new URL(a.href, location.href);
    if (url.origin !== location.origin || a.target) return;           // other sites, mail, phone
    if (url.pathname === location.pathname && !url.hash) return;      // this page
    e.preventDefault();
    Roll.leave(url.href, texts, boxes);
  });

  /* Scrolling back up goes back to Work: Contact sits right after it, so a
     wheel / swipe / key upwards from the top of this page returns there
     (rolling away first, like the WORK link). A small push is not enough,
     so a stray nudge or a trackpad's tail does not leave the page. */
  var gone = false, pushed = 0, lastWheel = 0, ty = null;
  function atTop() { return (window.scrollY || document.documentElement.scrollTop || 0) <= 1; }
  function back() {
    if (gone) return;
    gone = true;
    Roll.leave(new URL(document.body.dataset.up || "../#work", location.href).href, texts, boxes);
  }
  window.addEventListener("wheel", function (e) {
    var now = Date.now();
    if (now - lastWheel > 250) pushed = 0;   // a new gesture
    lastWheel = now;
    if (!atTop() || e.deltaY >= 0) { pushed = 0; return; }
    pushed += -e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
    if (pushed > 60) back();
  }, { passive: true });
  window.addEventListener("touchstart", function (e) {
    ty = e.touches.length === 1 && atTop() ? e.touches[0].clientY : null;
  }, { passive: true });
  window.addEventListener("touchmove", function (e) {
    if (ty != null && e.touches[0].clientY - ty > 70) { ty = null; back(); }
  }, { passive: true });
  // again as the finger lifts: once the browser takes the swipe as a
  // scroll it may stop reporting the moves
  window.addEventListener("touchend", function (e) {
    var t = e.changedTouches && e.changedTouches[0];
    if (ty != null && t && t.clientY - ty > 60) back();
    ty = null;
  }, { passive: true });
  window.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if ((e.key === "ArrowUp" || e.key === "PageUp" || e.key === "Home") && atTop()) back();
  });
})();
