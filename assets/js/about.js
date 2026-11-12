/* About (Figma 35:29437 / 35:29599): a long page with its own scroll.
   - The frame at the top (contact block, mark) rolls in when the page
     opens; every other piece rises in (letters rising, assets/js/roll.js,
     here without the blur) as it scrolls into view, so the page shows
     itself as you go down. Nothing fades away going up.
     The menu stays as it is.
   - Scrolled to the end, one more scroll down (wheel, swipe, key) goes on
     to Work; at the top, one more scroll up goes back to Home. Only a new
     push counts: the tail of the scroll that reached the end (a trackpad's
     inertia) does not leave the page.
   - The menu, the mark and the contact block stay at the top, always
     shown; where the content scrolls up under them they invert, like the
     Work mark and the cursor (a white copy in "difference" plus an ink
     copy in "plus-lighter": over paper they read ink, over ink paper).
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

  /* ---------- the top frame inverts over the content ----------
     Each of the menu, the contact block and the mark gets a twin: the
     real one turns white in "difference" (paper → near black, ink →
     light), the twin on top adds rgb(13 12 11) in "plus-lighter", so
     over the paper the sum is the ink #1c1c1c again and over the ink
     text it is the paper. Browsers without plus-lighter keep them plain. */
  var twins = [];
  if (window.CSS && CSS.supports("mix-blend-mode", "plus-lighter")) {
    q(".page-about .site-nav, .ab-info").forEach(function (el) {
      var tw = el.cloneNode(true);
      tw.setAttribute("aria-hidden", "true");
      tw.removeAttribute("aria-label");
      [].forEach.call(tw.querySelectorAll("a"), function (a) { a.tabIndex = -1; });
      [].forEach.call(tw.querySelectorAll("nav"), function (n) { n.removeAttribute("aria-label"); });
      el.classList.add("is-invert");
      tw.classList.add("is-tint");
      el.parentNode.insertBefore(tw, el.nextSibling);
      twins.push([el, tw]);
      // the twin follows the real links' hover lean
      var real = el.querySelectorAll("a"), copy = tw.querySelectorAll("a");
      [].forEach.call(real, function (a, i) {
        a.addEventListener("pointerenter", function () { if (copy[i]) copy[i].classList.add("is-hover"); });
        a.addEventListener("pointerleave", function () { if (copy[i]) copy[i].classList.remove("is-hover"); });
      });
    });
    q(".ab-mark").forEach(function (m) {
      var src = m.getAttribute("src"), tint = m.cloneNode(false);
      tint.setAttribute("src", src.replace("dizai-mark.svg", "dizai-mark-tint.svg"));
      m.setAttribute("src", src.replace("dizai-mark.svg", "dizai-mark-white.svg"));
      m.classList.add("is-invert");
      tint.classList.add("is-tint");
      m.parentNode.insertBefore(tint, m.nextSibling);
    });
  }

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
  // (rising into view without a blur)
  var pieces = texts.map(function (el) { return { el: el, r: Roll.text(el, "in", { blur: false }), on: false }; })
    .concat(photos.map(function (el) { return { el: el, r: Roll.box(el, "in", { blur: false }), on: false, box: true }; }));
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

  // from Work / Contact the mark was already here: it stays and turns over
  var keepMark = Roll.takeFlip && Roll.takeFlip();
  function enter() {
    var top = frame.map(function (el) { var r = Roll.text(el, "in"); r.set(0); return r; })
      .concat(keepMark ? [] : marks.map(function (el) { var r = Roll.box(el, "in"); r.set(0); return r; }));
    done();
    if (keepMark) Roll.flip(marks);
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

  /* Past an end, the push that goes on is counted: a light one if the
     scroll started with the page already there, a longer one if the same
     scroll has just arrived there (so it carries on smoothly, but the tail
     of a trackpad flick alone does not leave the page). */
  var lastWheel = 0, acc = 0, startEdge = 0; // +1 started at the end, −1 at the top
  window.addEventListener("wheel", function (e) {
    if (gone || e.ctrlKey) return;
    var now = performance.now(), fresh = now - lastWheel > 220;
    lastWheel = now;
    var dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
    if (fresh) { acc = 0; startEdge = dy > 0 && atEnd() ? 1 : dy < 0 && atTop() ? -1 : 0; }
    var dir = dy > 0 ? 1 : dy < 0 ? -1 : 0;
    if (!dir || !(dir > 0 ? atEnd() : atTop())) { acc = 0; return; }
    acc += Math.abs(dy);
    if (acc > (startEdge === dir ? 40 : 240)) leave(dir > 0 ? WORK : HOME);
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
