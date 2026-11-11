/* Loading screen (Figma "Loading" 13:257)
   1. Rolling count 0 → 100% (digits slide up), following real load progress:
      it can climb to 90% on time alone and only reaches 100% after "load".
   2. Hand-off to Home: the loader's text soaks away into the paper while the
      big seal shrinks and glides to its place on Home, where Home's own seal
      takes over. The Home elements then print in one by one:
      ink appears in the thick cores of the strokes first and bleeds out to
      the hairlines, with paper-fibre blotches.
   The soaking is an SVG filter per element: paper-fibre noise mixed with the
   blurred glyph (its stroke "core"), thresholded by a rising level.
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
    try { handOff(); } catch (e) { fadeOut(); }
  }

  /* ---------------- Hand-off: seal shrinks to Home, ink soaks ---------------- */

  var OUT_MS = 520, OUT_STAGGER = 70;          // loader text soaking away
  var SEAL_AT = 60, SEAL_MS = 1000;            // seal shrinking into place
  var IN_AT = 420, IN_MS = 780, IN_STAGGER = 90; // Home printing in

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function easeOut(x) { return 1 - Math.pow(1 - x, 3); }
  function easeInOut(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

  function handOff() {
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    document.body.appendChild(svg);

    function node(tag, attrs, parent) {
      var n = document.createElementNS(NS, tag);
      for (var k in attrs) n.setAttribute(k, attrs[k]);
      (parent || svg).appendChild(n);
      return n;
    }

    /* Ink-soak filter. alpha = S·(0.45·fibre + 0.75·core) + I, then the
       glyph is kept only where that alpha is. "core" is the blurred glyph,
       high in the middle of thick strokes, low in hairlines and at edges,
       so as I rises the ink fills cores first and bleeds outward. */
    var S = 8, I_HIDDEN = -S * 1.25, I_SHOWN = 1; // S: how sharp the ink edge is
    function soakFilter(el, i, h) {
      var f = node("filter", { id: "dz-ink-" + i, x: "-5%", y: "-10%", width: "110%", height: "120%",
                               "color-interpolation-filters": "sRGB" });
      var freq = Math.min(0.09, 0.022 * Math.max(1, 231 / h)); // fibres scale with type size
      node("feTurbulence", { type: "fractalNoise", baseFrequency: freq.toFixed(4), numOctaves: "3",
                             seed: String(5 + i * 11), result: "fibre" }, f);
      node("feColorMatrix", { "in": "fibre", type: "matrix", result: "fibreA",
                              values: "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" }, f);
      node("feGaussianBlur", { "in": "SourceAlpha", stdDeviation: Math.max(1.2, h * 0.02).toFixed(2), result: "core" }, f);
      node("feComposite", { "in": "fibreA", in2: "core", operator: "arithmetic",
                            k1: "0", k2: "0.45", k3: "0.75", k4: "0", result: "mix" }, f);
      var ct = node("feComponentTransfer", { "in": "mix", result: "level" }, f);
      var fa = node("feFuncA", { type: "linear", slope: String(S), intercept: String(I_HIDDEN) }, ct);
      node("feComposite", { "in": "SourceGraphic", in2: "level", operator: "in" }, f);
      // soak first, then the element's own ink bleed on what has soaked in
      var base = getComputedStyle(el).filter;
      el.style.filter = "url(#" + f.id + ")" + (base && base !== "none" ? " " + base : "");
      return fa;
    }

    function rectOf(el) { return el.getBoundingClientRect(); }
    function shown(el) { return el && el.getClientRects().length > 0; }

    var seal = loader.querySelector(".seal");
    var coin = document.querySelector(".type-row .seal");

    var out = [
      loader.querySelector(".loader-count"),
      loader.querySelector(".loader-contact"),
      loader.querySelector(".loader-top > p:first-child")
    ].filter(shown);
    var ins = [".site-nav .nav-list", ".line-design", ".line-studio",
               ".line-est", ".line-year", ".services", ".contact", ".scroll-hint", ".social"]
      .map(function (q) { return document.querySelector(q); })
      .filter(shown);

    // Home laid out but invisible until each piece prints in; the coin
    // waits until the loader's seal has landed on it
    ins.forEach(function (el) { el.style.opacity = "0"; });
    if (coin) coin.style.opacity = "0";
    root.classList.add("is-emerging");

    // the seal's flight: from its loader box to the coin's box (FLIP)
    var from = seal && rectOf(seal), to = coin && rectOf(coin);
    if (seal) seal.style.transformOrigin = "0 0";

    var items = [];
    out.forEach(function (el, i) {
      var r = rectOf(el);
      items.push({ el: el, dir: "out", start: i * OUT_STAGGER, dur: OUT_MS,
                   level: soakFilter(el, i, Math.max(r.height, 40)) });
    });
    ins.forEach(function (el, i) {
      var r = rectOf(el);
      items.push({ el: el, dir: "in", start: IN_AT + i * IN_STAGGER, dur: IN_MS,
                   level: soakFilter(el, 100 + i, Math.max(r.height, 40)) });
    });
    var total = Math.max(SEAL_AT + SEAL_MS, Math.max.apply(null, items.map(function (it) { return it.start + it.dur; })));

    var t0 = performance.now();
    (function frame() {
      var t = performance.now() - t0;

      if (seal && from && to) {
        var k = easeInOut(clamp01((t - SEAL_AT) / SEAL_MS));
        var sc = 1 + (to.height / from.height - 1) * k;
        var dx = (to.left - from.left) * k, dy = (to.top - from.top) * k;
        seal.style.transform = "translate(" + dx.toFixed(2) + "px," + dy.toFixed(2) + "px) scale(" + sc.toFixed(5) + ")";
        if (k >= 1) { coin.style.opacity = ""; seal.style.visibility = "hidden"; }
      }

      items.forEach(function (it) {
        var q = clamp01((t - it.start) / it.dur);
        if (it.dir === "out") {
          it.level.setAttribute("intercept", (I_SHOWN + (I_HIDDEN - I_SHOWN) * easeInOut(q)).toFixed(3));
        } else {
          var e = easeOut(q);
          it.level.setAttribute("intercept", (I_HIDDEN + (I_SHOWN - I_HIDDEN) * e).toFixed(3));
          it.el.style.opacity = q > 0 ? "1" : "0";
        }
      });

      if (t < total) return requestAnimationFrame(frame);
      ins.forEach(function (el) { el.style.opacity = el.style.filter = ""; });
      if (coin) coin.style.opacity = "";
      svg.remove();
      cleanup();
    })();
  }

  requestAnimationFrame(tick);
})();
