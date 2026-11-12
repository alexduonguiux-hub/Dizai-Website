/* Loading screen (Figma "Loading" 13:257)
   1. Rolling count 0 → 100% (digits slide up), following real load progress:
      it can climb to 90% on time alone and only reaches 100% after "load".
   2. Hand-off to Home: the loader's letters roll away (assets/js/roll.js,
      the same motion as the counter's digits) while the big seal shrinks
      and glides to its place on Home, where Home's own seal takes over.
      The Home text then rolls in, one block after another, every letter
      rolling up through its own little window.
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
    try { sessionStorage.setItem("dz-seen", "1"); } catch (e) {} // once per visit
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

  /* ---------------- Hand-off: seal shrinks to Home, letters roll ---------------- */

  var OUT_MS = 520, OUT_STAGGER = 70;          // loader text rolling away
  var SEAL_AT = 60, SEAL_MS = 1000;            // seal shrinking into place
  var IN_AT = 420, IN_MS = 700, IN_STAGGER = 80; // Home rolling in

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function easeInOut(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

  function handOff() {
    var Roll = window.DzRoll;
    if (!Roll) return fadeOut();
    function rectOf(el) { return el.getBoundingClientRect(); }
    function shown(el) { return el && el.getClientRects().length > 0; }

    var seal = loader.querySelector(".seal");
    var coin = document.querySelector(".type-row .seal");

    // the count is made of rolling digit cells: it slides out as one block
    var count = loader.querySelector(".loader-count");
    var out = [
      count && shown(count) ? Roll.box(count, "out") : null,
      Roll.text(loader.querySelector(".loader-contact"), "out"),
      Roll.text(loader.querySelector(".loader-top > p:first-child"), "out")
    ].filter(Boolean);
    var ins = [".line-design", ".line-studio",
               ".line-est", ".line-year", ".services", ".contact", ".scroll-hint", ".social"]
      .map(function (q) { return document.querySelector(q); })
      .filter(shown)
      .map(function (el) { var r = Roll.text(el, "in"); r.set(0); return r; }); // blank windows

    // Home laid out with every letter window blank; the coin waits until
    // the loader's seal has landed on it
    if (coin) coin.style.opacity = "0";
    root.classList.add("is-emerging");

    // the seal's flight: from its loader box to the coin's box (FLIP)
    var from = seal && rectOf(seal), to = coin && rectOf(coin);
    if (seal) seal.style.transformOrigin = "0 0";

    var items = [];
    out.forEach(function (r, i) { items.push({ r: r, start: i * OUT_STAGGER, dur: OUT_MS }); });
    ins.forEach(function (r, i) { items.push({ r: r, start: IN_AT + i * IN_STAGGER, dur: IN_MS }); });
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
      // every letter rolls with its own small delay inside the element
      items.forEach(function (it) { it.r.set(clamp01((t - it.start) / it.dur)); });

      if (t < total) return requestAnimationFrame(frame);
      ins.forEach(function (r) { r.set(1); }); // real text back
      if (coin) coin.style.opacity = "";
      cleanup();
    })();
  }

  requestAnimationFrame(tick);
})();
