/* Loading screen (Figma "Loading" 13:257)
   1. Rolling count 0 → 100% (digits slide up), following real load progress:
      it can climb to 90% on time alone and only reaches 100% after "load".
   2. Stamp + ink hand-off: the seal lifts, then presses down. The paper dents,
      a ring of ink spreads out, and the blow pushes the loader's own text
      away as it soaks into the paper. Then the Home elements print in one by
      one: ink appears in the thick cores of the strokes first and bleeds out
      to the hairlines, with paper-fibre blotches, while each line settles
      as if pressed into the sheet. An element in the same place on both
      screens (the seal on desktop) stays where it is.
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
    try { stampAndInk(); } catch (e) { fadeOut(); }
  }

  /* ---------------- Stamp + ink hand-off ---------------- */

  var LIFT_MS = 260, PRESS_MS = 130;          // seal up, then down
  var IMPACT = LIFT_MS + PRESS_MS;            // the moment it hits the paper
  var OUT_MS = 480, OUT_STAGGER = 60;         // loader text blown off, soaking away
  var IN_AT = IMPACT + 170, IN_MS = 780, IN_STAGGER = 90; // Home printing in

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function easeOut(x) { return 1 - Math.pow(1 - x, 3); }
  function easeInOut(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

  function stampAndInk() {
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
      el.style.filter = "url(#" + f.id + ")";
      return fa;
    }

    function rectOf(el) { return el.getBoundingClientRect(); }
    function same(a, b) {
      return Math.abs(a.left - b.left) < 2 && Math.abs(a.top - b.top) < 2 &&
             Math.abs(a.width - b.width) < 2 && Math.abs(a.height - b.height) < 2;
    }
    function shown(el) { return el && el.getClientRects().length > 0; }

    var seal = loader.querySelector(".seal");
    var homeSeal = document.querySelector(".type-row .seal-coin"); // the whole coin
    var shared = seal && homeSeal && same(rectOf(seal), rectOf(homeSeal));

    var out = [
      loader.querySelector(".loader-count"),
      loader.querySelector(".loader-contact"),
      loader.querySelector(".loader-top > p:first-child")
    ].filter(shown);
    var ins = [".site-nav .nav-list", ".line-design", ".line-studio"]
      .concat(shared ? [] : [".type-row .seal-coin"])
      .concat([".line-est", ".line-year", ".services", ".contact", ".scroll-hint", ".social"])
      .map(function (q) { return document.querySelector(q); })
      .filter(shown);

    // Home laid out but invisible until each piece prints in; a shared home
    // seal waits under the loader's until the stamp has settled
    ins.forEach(function (el) { el.style.opacity = "0"; });
    if (shared) homeSeal.style.opacity = "0";
    root.classList.add("is-emerging");

    var sr = rectOf(seal), cx = sr.left + sr.width / 2, cy = sr.top + sr.height / 2;

    // the dent in the paper and the ring of ink, centred on the seal
    var fx = document.createElement("div");
    fx.className = "stamp-fx";
    fx.style.cssText = "left:" + cx + "px;top:" + cy + "px;--d:" + sr.height + "px";
    fx.innerHTML = '<span class="stamp-dent"></span><span class="stamp-ring"></span>';
    document.body.appendChild(fx);
    var ringFilter = node("filter", { id: "dz-ring", x: "-20%", y: "-20%", width: "140%", height: "140%" });
    node("feTurbulence", { type: "fractalNoise", baseFrequency: "0.06", numOctaves: "2", seed: "7", result: "n" }, ringFilter);
    node("feDisplacementMap", { "in": "SourceGraphic", in2: "n", scale: "10",
                                xChannelSelector: "R", yChannelSelector: "G" }, ringFilter);
    var dent = fx.children[0], ring = fx.children[1];
    ring.style.filter = "url(#dz-ring)";

    var items = [];
    out.forEach(function (el, i) {
      var r = rectOf(el), ex = r.left + r.width / 2 - cx, ey = r.top + r.height / 2 - cy;
      var len = Math.hypot(ex, ey) || 1;
      items.push({ el: el, dir: "out", start: IMPACT + i * OUT_STAGGER, dur: OUT_MS,
                   push: [ex / len, ey / len], level: soakFilter(el, i, Math.max(r.height, 40)) });
    });
    var sealSoak = "";
    if (!shared && seal) { // on mobile the loader's seal soaks away after its stamp
      items.push({ el: seal, dir: "out", start: IMPACT + 260, dur: OUT_MS, push: [0, 0],
                   level: soakFilter(seal, 50, Math.max(sr.height, 40)) });
      sealSoak = seal.style.filter;
    }
    ins.forEach(function (el, i) {
      var r = rectOf(el);
      items.push({ el: el, dir: "in", start: IN_AT + i * IN_STAGGER, dur: IN_MS,
                   level: soakFilter(el, 100 + i, Math.max(r.height, 40)) });
    });
    var total = Math.max.apply(null, items.map(function (it) { return it.start + it.dur; }));

    var page = [document.querySelector(".hero"), document.querySelector(".site-nav"), loader];

    var t0 = performance.now();
    (function frame() {
      var t = performance.now() - t0;

      // the seal: lift (bigger, tilted, long shadow), press (squash), settle
      var lift = easeOut(clamp01(t / LIFT_MS));
      var press = clamp01((t - LIFT_MS) / PRESS_MS);
      var settle = clamp01((t - IMPACT) / 220);
      var sc, rot, sh;
      if (t < LIFT_MS) { sc = 1 + 0.1 * lift; rot = -4 * lift; sh = lift; }
      else if (t < IMPACT) { var p = press * press; sc = 1.1 - 0.13 * p; rot = -4 * (1 - p); sh = 1 - p; }
      else { sc = 0.97 + 0.03 * easeOut(settle) + 0.01 * Math.sin(settle * Math.PI); rot = 0; sh = 0; }
      if (shared && t >= IMPACT + 220) homeSeal.style.opacity = "";
      if (seal) {
        seal.style.transform = "scale(" + sc.toFixed(4) + ") rotate(" + rot.toFixed(2) + "deg)";
        // shadow while it is in the air; after the hit, its ink filter (if
        // it soaks away, on mobile) takes over
        seal.style.filter = t < IMPACT && sh > 0.001 ?
          "drop-shadow(0 " + (18 * sh).toFixed(1) + "px " + (22 * sh).toFixed(1) + "px rgba(33,80,40," + (0.28 * sh).toFixed(3) + "))" :
          (t < IMPACT ? "" : sealSoak);
      }

      // the blow: paper dents, ink ring spreads, the sheet gives a little
      var hit = clamp01((t - IMPACT) / 650);
      dent.style.opacity = t >= IMPACT ? String((1 - hit) * Math.min(1, hit * 8)) : "0";
      dent.style.transform = "translate(-50%,-50%) scale(" + (0.9 + 0.35 * easeOut(hit)).toFixed(3) + ")";
      ring.style.opacity = t >= IMPACT ? String(0.9 * Math.pow(1 - hit, 1.5)) : "0";
      ring.style.transform = "translate(-50%,-50%) scale(" + (0.85 + 0.8 * easeOut(hit)).toFixed(3) + ")";
      var thud = t >= IMPACT ? Math.sin(clamp01((t - IMPACT) / 160) * Math.PI) * 2 : 0;
      page.forEach(function (el) { if (el) el.style.translate = thud ? "0 " + thud.toFixed(2) + "px" : ""; });

      items.forEach(function (it) {
        var q = clamp01((t - it.start) / it.dur);
        if (it.dir === "out") {
          var e = easeOut(q);
          it.level.setAttribute("intercept", (I_SHOWN + (I_HIDDEN - I_SHOWN) * easeInOut(q)).toFixed(3));
          if (it.el !== seal) {
            var d = 34 * e;
            it.el.style.transform = "translate(" + (it.push[0] * d).toFixed(1) + "px," + (it.push[1] * d).toFixed(1) + "px) scale(" + (1 + 0.03 * e).toFixed(4) + ")";
          }
          it.el.style.opacity = String(1 - 0.35 * e);
        } else {
          var k = easeOut(q);
          it.level.setAttribute("intercept", (I_HIDDEN + (I_SHOWN - I_HIDDEN) * k).toFixed(3));
          it.el.style.opacity = q > 0 ? "1" : "0";
          // pressed into the sheet, then flat
          it.el.style.transform = "scale(" + (0.985 + 0.015 * k).toFixed(4) + ")";
        }
      });

      if (t < total) return requestAnimationFrame(frame);
      ins.forEach(function (el) { el.style.opacity = el.style.filter = el.style.transform = ""; });
      if (homeSeal) homeSeal.style.opacity = "";
      page.forEach(function (el) { if (el) el.style.translate = ""; });
      fx.remove();
      svg.remove();
      cleanup();
    })();
  }

  requestAnimationFrame(tick);
})();
