/* About (Figma 35:29437 / 35:29599): a long page with its own scroll.
   - The frame at the top (contact block, mark) rolls in when the page
     opens; every other piece rolls in (letters rising, assets/js/roll.js)
     as it scrolls into view, so the page shows itself as you go down.
     The menu stays as it is.
   - Scrolled to the end, one more scroll down (wheel, swipe, key) goes on
     to Work; at the top, one more scroll up goes back to Home. Only a new
     push counts: the tail of the scroll that reached the end (a trackpad's
     inertia) does not leave the page.
   - Leaving, what shows rolls away first (DzRoll.leave). */
(function () {
  "use strict";
  var root = document.documentElement;
  var Roll = window.DzRoll, gsap = window.gsap;
  function done() { root.classList.remove("is-entering"); }
  if (!Roll || !gsap) return done();

  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var q = function (s) { return [].slice.call(document.querySelectorAll(s)); };
  var shown = function (el) { return el.getClientRects().length; };

  // the pieces, in page order: text rolls, pictures rise
  var frame = q(".ab-info").filter(shown);
  var marks = q(".ab-mark");
  var texts = q(".ab-line, .ab-text p, .ab-contact .cp-kicker, .ab-contact .cp-email, .ab-contact .cp-social, .ab-copy").filter(shown);
  var photos = q(".ab-photo");
  // the content scrolls in its own frame under the menu and mark
  var sc = document.querySelector(".ab-scroll") || document.scrollingElement;
  if (sc.focus) { sc.setAttribute("tabindex", "-1"); try { sc.focus({ preventScroll: true }); } catch (e) {} } // arrow keys scroll it
  var HOME = new URL("../", location.href).href, WORK = new URL("../#work", location.href).href;

  // opened from Work going back up: start at the end
  if (location.hash === "#end") {
    history.replaceState(null, "", location.pathname);
    sc.scrollTop = sc.scrollHeight;
  }

  /* ---------- rolling in ---------- */
  var pieces = texts.map(function (el) { return { el: el, r: Roll.text(el, "in"), on: false }; })
    .concat(photos.map(function (el) { return { el: el, r: Roll.box(el, "in"), on: false, box: true }; }));
  pieces.forEach(function (p) { p.r.set(0); });

  var queued = 0, queueT = 0;
  function play(r, delay) {
    var o = { v: 0 };
    gsap.to(o, { v: 1, duration: reduce ? 0.01 : 0.9, delay: reduce ? 0 : delay, ease: "none",
                 onUpdate: function () { r.set(o.v); } });
  }
  function reveal(p) {
    if (p.on) return;
    p.on = true;
    // pieces coming into view together go one after another
    var now = performance.now();
    if (now - queueT > 250) queued = 0;
    queueT = now;
    play(p.r, 0.08 * queued++);
  }

  function enter() {
    var top = frame.map(function (el) { var r = Roll.text(el, "in"); r.set(0); return r; })
      .concat(marks.map(function (el) { var r = Roll.box(el, "in"); r.set(0); return r; }));
    done();
    top.forEach(function (r, i) { play(r, 0.1 + i * 0.07); });
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var p = pieces.filter(function (x) { return x.el === e.target; })[0];
          if (p) { reveal(p); io.unobserve(e.target); }
        });
      }, { rootMargin: "0px 0px -8% 0px" });
      pieces.forEach(function (p) { io.observe(p.el); });
    } else pieces.forEach(reveal);
    // at the very end everything left shows (the last line sits too close
    // to the foot to ever pass the line where pieces come in)
    function endCheck() { if (atEnd()) pieces.forEach(reveal); }
    sc.addEventListener("scroll", endCheck, { passive: true });
    endCheck();
  }
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(enter);

  /* ---------- fading out under the top ----------
     Each piece fades right out (as a whole) once it rises past the line
     where the title starts, before it can pass under the menu or the
     mark, and fades back in when it comes down below that line again. */
  var fades = q(".ab-line, .ab-photo-box, .ab-text p, .ab-contact .cp-kicker, .ab-contact .cp-l, .ab-contact .cp-social, .ab-copy")
    .filter(shown).map(function (el) { return { el: el, out: false }; });
  var flow = document.querySelector(".ab-flow");
  function fadeLine() {
    // the title's top at the start: the frame's padding + the flow's
    return parseFloat(getComputedStyle(sc).paddingTop) + (flow ? parseFloat(getComputedStyle(flow).paddingTop) : 0) - 2;
  }
  var line = fadeLine(), fadeRaf = 0;
  function fadeCheck() {
    fadeRaf = 0;
    fades.forEach(function (f) {
      var out = f.el.getBoundingClientRect().top < line;
      if (out === f.out) return;
      f.out = out;
      gsap.to(f.el, { opacity: out ? 0 : 1, duration: reduce ? 0.01 : out ? 0.45 : 0.6,
                      ease: out ? "power2.out" : "power2.inOut", overwrite: "auto" });
    });
  }
  sc.addEventListener("scroll", function () { if (!fadeRaf) fadeRaf = requestAnimationFrame(fadeCheck); }, { passive: true });
  window.addEventListener("resize", function () { line = fadeLine(); fadeCheck(); });
  fadeCheck();

  // pieces still waiting below: measured again when the width changes
  // (their letters keep the line breaks of the width they were split at)
  var rw = innerWidth, rT = 0;
  window.addEventListener("resize", function () {
    clearTimeout(rT);
    rT = setTimeout(function () {
      if (innerWidth === rw) return;
      rw = innerWidth;
      pieces.forEach(function (p) { if (!p.on && !p.box) { p.r.revert(); p.r.set(0); } });
    }, 120);
  });

  /* ---------- leaving ---------- */
  var gone = false;
  function leave(href) {
    if (gone) return;
    gone = true;
    Roll.leave(href, frame.concat(texts), marks.concat(photos));
  }
  window.addEventListener("pageshow", function (e) { if (e.persisted) gone = false; });

  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    var url = new URL(a.href, location.href);
    if (url.origin !== location.origin || a.target) return;           // other sites, mail, phone
    if (url.pathname === location.pathname && !url.hash) return;      // this page
    e.preventDefault();
    leave(url.href);
  });

  /* ---------- past the ends: Work below, Home above ---------- */
  function atTop() { return sc.scrollTop <= 1; }
  function atEnd() { return sc.clientHeight + sc.scrollTop >= sc.scrollHeight - 2; }

  var lastWheel = 0, acc = 0, armed = 0; // armed: +1 at the end, −1 at the top
  window.addEventListener("wheel", function (e) {
    if (gone || e.ctrlKey) return;
    var now = performance.now(), fresh = now - lastWheel > 220;
    lastWheel = now;
    var dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
    // a push counts only if it started with the page already at that end
    if (fresh) { acc = 0; armed = dy > 0 && atEnd() ? 1 : dy < 0 && atTop() ? -1 : 0; }
    if (!armed || (armed > 0 ? dy <= 0 : dy >= 0)) return;
    acc += Math.abs(dy);
    if (acc > 50) leave(armed > 0 ? WORK : HOME);
  }, { passive: true });

  var touch = null;
  window.addEventListener("touchstart", function (e) {
    if (e.touches.length !== 1) { touch = null; return; }
    touch = { y: e.touches[0].clientY, end: atEnd(), top: atTop() };
  }, { passive: true });
  // checked as the finger moves and again as it lifts: once the browser
  // takes a swipe as a scroll it may stop reporting the moves
  function swiped(y) {
    if (!touch || gone) return;
    var dy = y - touch.y;
    if (touch.end && dy < -50) { touch = null; leave(WORK); }
    else if (touch.top && dy > 60) { touch = null; leave(HOME); }
  }
  window.addEventListener("touchmove", function (e) { swiped(e.touches[0].clientY); }, { passive: true });
  window.addEventListener("touchend", function (e) {
    var t = e.changedTouches && e.changedTouches[0];
    if (t) swiped(t.clientY);
    touch = null;
  }, { passive: true });

  window.addEventListener("keydown", function (e) {
    if (gone || e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key;
    if ((k === "ArrowDown" || k === "PageDown" || k === "End" || (k === " " && !e.shiftKey)) && atEnd()) { e.preventDefault(); leave(WORK); }
    else if ((k === "ArrowUp" || k === "PageUp" || k === "Home" || (k === " " && e.shiftKey)) && atTop()) { e.preventDefault(); leave(HOME); }
  });
})();
