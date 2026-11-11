/* Loading screen (Figma "Loading" 13:257)
   1. Rolling count 0 → 100% (digits slide up), following real load progress:
      it can climb to 90% on time alone and only reaches 100% after "load".
   2. Water hand-off: what exists only on the loader (LOADING..., the count,
      its contact block) sinks below a water line, rippling as it goes; then
      the Home elements rise up through the same water line, one after another,
      the ripples calming as they settle. An element that sits in the same
      place on both screens (the seal on desktop) simply stays.
   Ripples are an SVG turbulence + displacement filter per element.
   prefers-reduced-motion gets a short fade instead. */
(function () {
  "use strict";

  var root = document.documentElement;
  var loader = document.querySelector(".loader");
  if (!loader || !root.classList.contains("is-loading")) return;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var MIN_MS = reduce ? 300 : 1800; // shortest time from 0 to 100
  var HOLD_MS = reduce ? 0 : 350;   // pause on 100% before the hand-off
  var SETTLE_MS = reduce ? 0 : 400;  // matches .is-settled transition in CSS

  /* ---------------- Rolling counter ---------------- */

  /* Text metrics in em, from the count's own font on a canvas. Returns
     null until the web font is ready (never cache fallback metrics). */
  var metricsCtx = document.createElement("canvas").getContext("2d");
  var metricsCache = {};
  function advance(t) {
    if (!t) return 0;
    if (!(t in metricsCache)) {
      var cs = getComputedStyle(countEl);
      metricsCtx.font = cs.fontStyle + " " + cs.fontWeight + " 100px " + cs.fontFamily;
      if (!document.fonts.check(metricsCtx.font)) return null;
      metricsCache[t] = metricsCtx.measureText(t).width / 100;
    }
    return metricsCache[t];
  }
  // Separate cells lose the font's kerning ("10" is tighter than "1" + "0");
  // it comes back as a margin on the right-hand cell.
  function kern(a, b) {
    if (!a || !b) return 0;
    var ab = advance(a + b), wa = advance(a), wb = advance(b);
    return ab === null || wa === null || wb === null ? null : ab - wa - wb;
  }

  function RollCell(host, onTarget) {
    var el = document.createElement("span");
    el.className = "roll";
    el.innerHTML = '<span class="roll-cur"></span><span class="roll-next"></span>';
    host.appendChild(el);
    var curEl = el.children[0], nextEl = el.children[1];
    var cell = { el: el, target: "" };
    var cur = "", pending = null, busy = false;

    function roll(to) {
      busy = true;
      cell.target = to;
      onTarget();               // width and kerning ease toward the new digit
      nextEl.textContent = to;
      el.classList.remove("is-rolling");
      void el.offsetWidth;      // restart the animation
      el.classList.add("is-rolling");
    }
    nextEl.addEventListener("animationend", function () {
      cur = nextEl.textContent;
      curEl.textContent = cur;
      el.classList.remove("is-rolling");
      busy = false;
      // the counter outruns the roll on the units digit: go straight to
      // the latest value rather than queueing every step
      if (pending !== null && pending !== cur) { var d = pending; pending = null; roll(d); }
      else pending = null;
    });

    cell.set = function (d) {
      if (reduce) { cur = curEl.textContent = cell.target = d; onTarget(); return; }
      if (busy) { pending = d; return; }
      if (d !== cur) roll(d);
    };
    cell.idle = function () { return !busy && pending === null; };
    return cell;
  }

  var countEl = loader.querySelector(".loader-count");
  countEl.textContent = "";
  var cells = [];
  var pctEl = document.createElement("span");
  pctEl.className = "roll-pct";
  pctEl.textContent = "%";

  /* While counting, every digit cell has the same width (the widest digit),
     so the row never shifts sideways as narrow and wide digits pass through.
     At 100% the cells ease once to each digit's real width plus the font's
     kerning, which is how Figma sets "100%". Width and margin transitions
     live in CSS. */
  var settled = false;
  var finalDigits = ["1", "0", "0"]; // where the row ends up
  var digitW = null;
  function widestDigit() {
    if (digitW === null) {
      var w = 0;
      for (var i = 0; i <= 9; i++) {
        var a = advance(String(i));
        if (a === null) return null;
        w = Math.max(w, a);
      }
      digitW = w;
    }
    return digitW;
  }
  function layout() {
    var prev = "", tab = widestDigit();
    for (var i = 0; i < cells.length; i++) {
      // once settling, aim straight at the final "100%" so a digit still
      // rolling 9 → 0 can't retarget the move halfway
      var d = settled ? finalDigits[i] : cells[i].target;
      var w = settled ? advance(d) : (d ? tab : 0);
      var k = settled ? kern(prev, d) : 0;
      if (w !== null) cells[i].el.style.width = w + "em";
      if (k !== null) cells[i].el.style.marginLeft = k + "em";
      if (d) prev = d;
    }
    var kp = settled ? kern(prev, "%") : 0;
    if (kp !== null) pctEl.style.marginLeft = kp + "em";
  }
  function settle() {
    settled = true;
    countEl.classList.add("is-settled");
    layout();
  }
  for (var c = 0; c < 3; c++) cells.push(RollCell(countEl, layout));
  countEl.appendChild(pctEl);
  document.fonts.ready.then(layout);

  function showCount(n) {
    var s = String(n);
    while (s.length < 3) s = " " + s;
    if (n >= 100 && !settled) {
      // last roll eases out, and the leading 1 arrives straight into
      // Figma's spacing: one sideways move instead of two
      countEl.classList.add("is-final");
      settle();
    }
    for (var i = 0; i < 3; i++) cells[i].set(s[i] === " " ? "" : s[i]);
  }
  showCount(0);

  /* ---------------- Progress ---------------- */

  var start = performance.now();
  var loaded = document.readyState === "complete";
  var shown = 0;
  window.addEventListener("load", function () { loaded = true; });

  function tick(now) {
    var t = Math.min(1, (now - start) / MIN_MS);
    var target = (1 - Math.pow(1 - t, 3)) * 100; // ease-out
    if (!loaded) target = Math.min(target, 90);
    shown += (target - shown) * 0.2;             // a late "load" eases in
    if (target - shown < 0.5) shown = target;
    var value = Math.floor(shown);
    showCount(value);
    if (value >= 100) return waitForDigits();
    requestAnimationFrame(tick);
  }

  function waitForDigits() {
    if (cells.every(function (c) { return c.idle(); })) {
      setTimeout(reveal, SETTLE_MS + HOLD_MS);   // let the settle finish
    } else requestAnimationFrame(waitForDigits);
  }

  /* ---------------- Reveal ---------------- */

  function cleanup() {
    root.classList.remove("is-loading", "is-loaded", "is-emerging");
    loader.remove();
  }

  function fadeOut() {
    root.classList.add("is-loaded");
    var done = false;
    function end() { if (!done) { done = true; cleanup(); } }
    if (reduce) return end();
    loader.addEventListener("transitionend", end);
    setTimeout(end, 800);
  }

  function reveal() {
    loader.classList.add("is-done"); // dots stop, all three shown
    if (reduce) return fadeOut();
    try { water(); } catch (e) { fadeOut(); }
  }

  /* ---------------- Water hand-off ---------------- */

  var SINK_MS = 800, RISE_MS = 1000;
  var SINK_STAGGER = 90, RISE_STAGGER = 90;
  var RISE_AT = 450; // home starts rising while the loader is still sinking

  function water() {
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    document.body.appendChild(svg);

    // one ripple filter per element so each can be at its own point in time
    function ripple(el, i) {
      var f = document.createElementNS(NS, "filter");
      f.id = "dz-water-" + i;
      f.setAttribute("x", "-10%"); f.setAttribute("y", "-40%");
      f.setAttribute("width", "120%"); f.setAttribute("height", "180%");
      f.setAttribute("color-interpolation-filters", "sRGB");
      var turb = document.createElementNS(NS, "feTurbulence");
      turb.setAttribute("type", "fractalNoise");
      turb.setAttribute("numOctaves", "1"); // smooth swell, no grit
      turb.setAttribute("seed", String(3 + i * 7));
      turb.setAttribute("result", "noise");
      var disp = document.createElementNS(NS, "feDisplacementMap");
      disp.setAttribute("in", "SourceGraphic");
      disp.setAttribute("in2", "noise");
      disp.setAttribute("xChannelSelector", "R");
      disp.setAttribute("yChannelSelector", "G");
      disp.setAttribute("scale", "0");
      f.appendChild(turb); f.appendChild(disp); svg.appendChild(f);
      el.style.filter = "url(#" + f.id + ")";
      return { turb: turb, disp: disp };
    }

    function rectOf(el) { return el.getBoundingClientRect(); }
    function same(a, b) {
      return Math.abs(a.left - b.left) < 2 && Math.abs(a.top - b.top) < 2 &&
             Math.abs(a.width - b.width) < 2 && Math.abs(a.height - b.height) < 2;
    }

    // Home must be laid out (but invisible) to measure it
    var rising = [
      ".site-nav .nav-list", ".line-design", ".line-studio", ".type-row .seal",
      ".line-est", ".line-year", ".services", ".contact", ".social"
    ].map(function (q) { return document.querySelector(q); }).filter(Boolean);
    rising.forEach(function (el) { el.style.opacity = "0"; });
    root.classList.add("is-emerging"); // home visible, loader ground clear

    var loaderSeal = loader.querySelector(".seal");
    var homeSeal = document.querySelector(".type-row .seal");
    var sinking = [
      loader.querySelector(".loader-top > p:first-child"),
      loader.querySelector(".loader-contact"),
      loader.querySelector(".loader-count")
    ];
    if (loaderSeal && homeSeal && same(rectOf(loaderSeal), rectOf(homeSeal))) {
      // shared element: the home seal is already exactly where the loader's is
      rising.splice(rising.indexOf(homeSeal), 1);
      homeSeal.style.opacity = "";
    } else if (loaderSeal) {
      sinking.push(loaderSeal);
    }
    sinking = sinking.filter(Boolean);

    var items = [];
    sinking.forEach(function (el, i) {
      items.push({ el: el, sink: true, start: i * SINK_STAGGER, dur: SINK_MS,
                   h: Math.max(rectOf(el).height, 40), fx: ripple(el, i) });
    });
    rising.forEach(function (el, i) {
      items.push({ el: el, sink: false, start: RISE_AT + i * RISE_STAGGER, dur: RISE_MS,
                   h: Math.max(rectOf(el).height, 40), fx: ripple(el, 100 + i) });
    });
    // ripple strength and size follow the element: ~20% of its height,
    // wavelengths relative to a 231px display line
    items.forEach(function (it) {
      it.amp = Math.min(44, it.h * 0.2);
      it.k = Math.min(3, 231 / it.h);
    });
    var total = Math.max.apply(null, items.map(function (it) { return it.start + it.dur; }));

    function mask(el, line) {
      // visible above the water line (in % of the element's height), soft edge
      var m = "linear-gradient(to bottom, #000 " + (line - 10) + "%, transparent " + (line + 6) + "%)";
      el.style.webkitMaskImage = el.style.maskImage = m;
    }

    var t0 = performance.now();
    (function frame() {
      var now = performance.now(), t = now - t0, sec = t / 1000;
      items.forEach(function (it) {
        var q = Math.min(1, Math.max(0, (t - it.start) / it.dur));
        var el = it.el, e, dy, line, amp, alpha;
        if (it.sink) {
          e = q * q * q;                          // ease-in: slips under
          dy = e * it.h;                          // goes down by its own height
          line = (1 - e) * 110;                   // water line stays put on screen
          amp = it.amp * Math.min(1, q * 1.6);    // ripples build as it goes under
          alpha = 1 - e * 0.5;
        } else {
          e = 1 - Math.pow(1 - q, 3);             // ease-out: surfaces, settles
          dy = (1 - e) * it.h * 0.7;
          line = e * 116;
          amp = it.amp * 1.1 * Math.pow(1 - q, 1.4); // ripples calm down
          alpha = q === 0 ? 0 : Math.min(1, 0.15 + e * 1.2);
        }
        el.style.transform = "translate3d(0," + dy.toFixed(2) + "px,0)";
        el.style.opacity = String(alpha);
        mask(el, line);
        it.fx.disp.setAttribute("scale", amp.toFixed(2));
        // moving water: the ripple pattern breathes and drifts
        // (frequencies scale with the element so small text gets the same
        // number of waves per letter as the big lines)
        var fy = it.k * (0.024 + 0.006 * Math.sin(sec * 5 + it.start / 200));
        var fx = it.k * (0.003 + 0.001 * Math.cos(sec * 3.2 + it.start / 300));
        it.fx.turb.setAttribute("baseFrequency", fx.toFixed(5) + " " + fy.toFixed(5));
      });
      if (t < total) return requestAnimationFrame(frame);
      // hand back clean elements
      rising.forEach(function (el) {
        el.style.transform = el.style.opacity = el.style.filter = "";
        el.style.webkitMaskImage = el.style.maskImage = "";
      });
      svg.remove();
      cleanup();
    })();
  }

  requestAnimationFrame(tick);
})();
