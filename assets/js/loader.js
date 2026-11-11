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
    // real water (WebGL) → simpler SVG ripples → plain fade
    try { if (glWater()) return; } catch (e) { /* fall through */ }
    try { svgWater(); } catch (e) { fadeOut(); }
  }

  /* ---------------- Water hand-off: SVG fallback ---------------- */

  var SINK_MS = 800, RISE_MS = 1000;
  var SINK_STAGGER = 90, RISE_STAGGER = 90;
  var RISE_AT = 450; // home starts rising while the loader is still sinking

  function svgWater() {
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

  /* ---------------- Water hand-off: WebGL pool ----------------
     The page becomes a pool seen from above. Every element is painted into
     its own colour channel (3 per texture), so each can sit at its own depth:
     depth 0 = at the surface, exactly as on the page; depth 1 = gone.
     Sinking shrinks the element toward its centre (further away), blurs and
     fades it into the water and lets the waves refract it. Each element
     dropping in, and each Home element breaking the surface, sends out a
     ring of ripples. The ripples' height field drives refraction, caustic
     light on the paper and small specular glints. First and last frames are
     flat water, identical to the DOM, so the swaps are invisible. */

  var GL_SINK_MS = 800, GL_RISE_MS = 1150, GL_STAGGER = 110, GL_RISE_AT = 560;
  var MAX_CH = 15, MAX_DROPS = 16;

  var GL_VS = "attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }";

  var GL_FS = [
    "#ifdef GL_FRAGMENT_PRECISION_HIGH",
    "precision highp float;",
    "#else",
    "precision mediump float;",
    "#endif",
    "uniform sampler2D uT0, uT1, uT2, uT3, uT4;",
    "uniform vec2 uRes;",        // CSS px
    "uniform vec2 uBuf;",        // drawing-buffer px
    "uniform float uTime, uSwell, uFade;",
    "uniform float uD[15];",     // depth per channel (>= 2 = unused)
    "uniform vec3 uC[15];",      // ink colour per channel
    "uniform vec2 uCtr[15];",    // element centre, uv
    "uniform vec3 uDrop[16];",   // ripple source: x, y (px), start time (s; <0 = none)
    "uniform vec3 uPaper;",

    "float height(vec2 p) {",
    "  float h = uSwell * (0.5 * sin(p.x * 0.017 + uTime * 1.7)",
    "         + 0.7 * sin((p.x * 0.6 + p.y) * 0.011 - uTime * 1.3)",
    "         + 0.3 * sin((p.y - p.x * 0.3) * 0.023 + uTime * 2.1));",
    "  for (int i = 0; i < 16; i++) {",
    "    float t0 = uDrop[i].z;",
    "    float dt = uTime - t0;",
    "    if (t0 < 0.0 || dt <= 0.0) continue;",
    "    float r = distance(p, uDrop[i].xy);",
    "    float front = dt * 430.0;",
    "    float w = 45.0 + dt * 70.0;",
    "    float x = (r - front) / w;",
    "    h += 1.7 * exp(-dt * 1.25) * exp(-x * x) * sin((r - front) * 0.15);",
    "  }",
    "  return h * uFade;",
    "}",

    "float chan(int i, vec2 q) {",
    "  vec4 t;",
    "  if (i < 3) t = texture2D(uT0, q);",
    "  else if (i < 6) t = texture2D(uT1, q);",
    "  else if (i < 9) t = texture2D(uT2, q);",
    "  else if (i < 12) t = texture2D(uT3, q);",
    "  else t = texture2D(uT4, q);",
    "  int c = i - (i / 3) * 3;",
    "  return c == 0 ? t.r : (c == 1 ? t.g : t.b);",
    "}",

    "void main() {",
    "  vec2 uv = vec2(gl_FragCoord.x / uBuf.x, 1.0 - gl_FragCoord.y / uBuf.y);",
    "  vec2 p = uv * uRes;",
    "  float e = 3.0;",
    "  float h0 = height(p), hx = height(p + vec2(e, 0.0)), hy = height(p + vec2(0.0, e));",
    "  vec2 g = vec2(hx - h0, hy - h0) / e;",                    // surface slope
    // curvature from the slope's spread (3 height samples instead of 5)
    "  float lap = (height(p - vec2(e, 0.0) - vec2(0.0, e)) + hx + hy - 3.0 * h0) / (e * e) * 1.33;",
    "  vec2 refr = g * 9.0 / uRes;",                             // refraction, uv

    // the paper is the pool floor: caustics focus light where the surface
    // curves inward, and darken a little where it spreads it out
    "  vec3 col = uPaper;",
    "  float caus = clamp(-lap * 26.0, -0.6, 1.2);",
    "  col *= 1.0 + caus * 0.05;",
    "  col = mix(col, vec3(1.0), max(caus, 0.0) * 0.05);",

    "  for (int i = 0; i < 15; i++) {",
    "    float d = uD[i];",
    "    if (d >= 0.999) continue;",
    "    vec2 q = uCtr[i] + (uv - uCtr[i]) * (1.0 + d * 0.16) + refr * (1.0 + d * 5.0);",
    "    float cov = chan(i, q);",
    "    if (d > 0.02) {",                                       // depth blur
    "      vec2 r = vec2(d * 9.0) / uRes;",
    "      cov = cov * 0.36 + 0.16 * (chan(i, q + vec2(r.x, r.y)) + chan(i, q - vec2(r.x, r.y))",
    "            + chan(i, q + vec2(r.x, -r.y)) + chan(i, q + vec2(-r.x, r.y)));",
    "    }",
    "    float a = cov * pow(1.0 - d, 1.4);",
    "    vec3 ink = mix(uC[i], uPaper * 0.94, d * 0.55);",       // water veils it
    "    ink *= 1.0 + caus * 0.08 * (1.0 - d);",                 // light plays on it too
    "    col = mix(col, ink, a);",
    "  }",

    // glints where a wave faces the light
    "  vec3 n = normalize(vec3(-g * 3.0, 1.0));",
    "  float spec = pow(max(dot(n, normalize(vec3(-0.35, 0.45, 1.0))), 0.0), 220.0);",
    "  col += spec * 0.5 * uFade;",
    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");

  function hexToRgb(c) {
    var m = c.match(/\d+(\.\d+)?/g);
    return m ? [m[0] / 255, m[1] / 255, m[2] / 255] : [0, 0, 0];
  }

  /* Paint one element's ink, as a coverage mask, into one colour channel of
     a 2D canvas (additive, so the three channels stay independent). */
  var CH_COLOR = ["#ff0000", "#00ff00", "#0000ff"];
  var maskTmp = null;
  function paintMask(ctx, el, chColor, dpr) {
    // one scratch canvas, reused for every element
    if (!maskTmp || maskTmp.width !== ctx.canvas.width || maskTmp.height !== ctx.canvas.height) {
      maskTmp = document.createElement("canvas");
      maskTmp.width = ctx.canvas.width; maskTmp.height = ctx.canvas.height;
    }
    var tmp = maskTmp, t = tmp.getContext("2d");
    t.setTransform(1, 0, 0, 1, 0, 0);
    t.globalCompositeOperation = "source-over";
    t.clearRect(0, 0, tmp.width, tmp.height);
    t.scale(dpr, dpr);
    t.fillStyle = "#fff";
    t.textBaseline = "alphabetic";
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var range = document.createRange();
    for (var node = walker.nextNode(); node; node = walker.nextNode()) {
      var text = node.nodeValue.replace(/\s+/g, " ").trim();
      var parent = node.parentElement;
      if (!text) continue;
      var cs = getComputedStyle(parent);
      if (cs.visibility === "hidden" && !parent.closest(".hero, .site-nav")) continue;
      if (parent.closest(".roll-next")) continue;
      if (cs.textTransform === "uppercase") text = text.toUpperCase();
      var size = parseFloat(cs.fontSize);
      t.font = cs.fontStyle + " " + cs.fontWeight + " " + size + "px " + cs.fontFamily;
      range.selectNodeContents(node);
      var r = range.getBoundingClientRect();
      t.fillText(text, r.left, r.top + 0.96 * size); // content box starts at the ascender
    }
    // the nav's arrow lives in a pseudo-element in a system font
    el.querySelectorAll("a").forEach(function (a) {
      ["::before", "::after"].forEach(function (pseudo) {
        var ps = getComputedStyle(a, pseudo), c = ps.content;
        if (!c || c === "none" || c === "normal" || c.indexOf("url(") === 0) return;
        c = c.replace(/^["']|["']$/g, "");
        var size = parseFloat(ps.fontSize);
        t.font = ps.fontStyle + " " + ps.fontWeight + " " + size + "px " + ps.fontFamily;
        var ar = a.getBoundingClientRect(), w = t.measureText(c).width;
        var x = pseudo === "::before" ? ar.left : ar.right - w;
        t.fillText(c, x, ar.top + 0.96 * size);
      });
    });
    var imgs = el.tagName === "IMG" ? [el] : [].slice.call(el.querySelectorAll("img"));
    imgs.forEach(function (img) {
      var r = img.getBoundingClientRect();
      t.drawImage(img, r.left, r.top, r.width, r.height);
    });
    // the ✱ between LinkedIn and Facebook is a pseudo-element image (mobile)
    if (el.classList.contains("social") && starImg.complete) {
      el.querySelectorAll("li + li").forEach(function (li) {
        var c = getComputedStyle(li, "::before").content;
        if (!c || c === "none") return;
        var r = li.getBoundingClientRect();
        t.drawImage(starImg, r.left, r.top + r.height / 2 - 5, 10, 10);
      });
    }
    // turn white ink into this channel's colour, then add it in
    t.setTransform(1, 0, 0, 1, 0, 0);
    t.globalCompositeOperation = "source-in";
    t.fillStyle = chColor;
    t.fillRect(0, 0, tmp.width, tmp.height);
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(tmp, 0, 0);
  }
  var starImg = new Image();
  starImg.src = "assets/img/star.svg";

  function inkColor(el) {
    if (el.tagName === "IMG") return [0x74 / 255, 0x96 / 255, 0x74 / 255]; // seal
    return hexToRgb(getComputedStyle(el).color);
  }

  function glWater() {
    var canvas = document.createElement("canvas");
    canvas.className = "water";
    var gl = canvas.getContext("webgl", { antialias: false, alpha: false });
    if (!gl) return false;

    // The shader is per-pixel heavy; render at up to 1.25× (the first and
    // last frames are flat water, so the swap to/from crisp DOM is subtle)
    var dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    var W = window.innerWidth, H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);

    function same(a, b) {
      return Math.abs(a.left - b.left) < 2 && Math.abs(a.top - b.top) < 2 &&
             Math.abs(a.width - b.width) < 2 && Math.abs(a.height - b.height) < 2;
    }
    var loaderSeal = loader.querySelector(".seal");
    var homeSeal = document.querySelector(".type-row .seal");
    var shared = loaderSeal && homeSeal &&
      same(loaderSeal.getBoundingClientRect(), homeSeal.getBoundingClientRect());

    // the count goes under first: "2024" later rises where it was
    var sinking = [
      loader.querySelector(".loader-count"),
      loader.querySelector(".loader-contact"),
      loader.querySelector(".loader-top > p:first-child")
    ];
    if (!shared) sinking.push(loaderSeal);
    var rising = [".site-nav .nav-list", ".line-design", ".line-studio"]
      .concat(shared ? [] : [".type-row .seal"])
      .concat([".line-est", ".line-year", ".services", ".contact", ".social"])
      .map(function (q) { return document.querySelector(q); });
    sinking = sinking.filter(Boolean); rising = rising.filter(Boolean);

    var chans = [];
    sinking.forEach(function (el, i) { chans.push({ el: el, kind: "sink", start: i * GL_STAGGER, dur: GL_SINK_MS }); });
    rising.forEach(function (el, i) { chans.push({ el: el, kind: "rise", start: GL_RISE_AT + i * GL_STAGGER, dur: GL_RISE_MS }); });
    if (shared) chans.push({ el: homeSeal, kind: "still" });
    if (chans.length > MAX_CH) return false;

    // paint the channel textures
    var texCanvases = [];
    chans.forEach(function (ch, i) {
      var k = Math.floor(i / 3);
      if (!texCanvases[k]) {
        var c = document.createElement("canvas");
        c.width = canvas.width; c.height = canvas.height;
        var cx = c.getContext("2d");
        cx.fillStyle = "#000"; cx.fillRect(0, 0, c.width, c.height);
        texCanvases[k] = c;
      }
      paintMask(texCanvases[k].getContext("2d"), ch.el, CH_COLOR[i % 3], dpr);
      var r = ch.el.getBoundingClientRect();
      ch.ctr = [(r.left + r.width / 2) / W, (r.top + r.height / 2) / H];
      ch.px = [r.left + r.width / 2, r.top + r.height / 2];
      ch.color = inkColor(ch.el.tagName === "IMG" ? ch.el : (ch.el.querySelector("p, li, a, span") || ch.el));
      if (ch.el.tagName !== "IMG" && ch.el.matches(".line-est, .line-year")) ch.color = hexToRgb(getComputedStyle(ch.el).color);
    });

    // GL setup
    function shader(type, src) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      return sh;
    }
    var prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, GL_VS));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, GL_FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    for (var k = 0; k < 5; k++) {
      gl.activeTexture(gl.TEXTURE0 + k);
      var tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (texCanvases[k]) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, texCanvases[k]);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array(3));
      gl.uniform1i(gl.getUniformLocation(prog, "uT" + k), k);
    }
    function U(n) { return gl.getUniformLocation(prog, n); }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U("uRes"), W, H);
    gl.uniform2f(U("uBuf"), canvas.width, canvas.height);
    gl.uniform3fv(U("uPaper"), hexToRgb(getComputedStyle(document.body).backgroundColor));
    var C = new Float32Array(MAX_CH * 3), CT = new Float32Array(MAX_CH * 2);
    chans.forEach(function (ch, i) {
      C.set(ch.color, i * 3); CT.set(ch.ctr, i * 2);
    });
    gl.uniform3fv(U("uC"), C);
    gl.uniform2fv(U("uCtr"), CT);

    // ripple sources: a drop as each element goes in, a splash as each
    // Home element breaks the surface (depth 0.3 on its way up)
    var drops = new Float32Array(MAX_DROPS * 3).fill(-1), nd = 0;
    var SURFACE_Q = 1 - Math.pow(0.3, 1 / 3);
    chans.forEach(function (ch) {
      if (ch.kind === "still" || nd >= MAX_DROPS) return;
      var t0 = ch.kind === "sink" ? (ch.start + 120) / 1000 : (ch.start + SURFACE_Q * ch.dur) / 1000;
      drops.set([ch.px[0], ch.px[1], t0], nd++ * 3);
    });
    gl.uniform3fv(U("uDrop"), drops);

    var total = Math.max.apply(null, chans.map(function (ch) { return ch.kind === "still" ? 0 : ch.start + ch.dur; })) + 700;
    var D = new Float32Array(MAX_CH).fill(2);
    var uD = U("uD"), uTime = U("uTime"), uSwell = U("uSwell"), uFade = U("uFade");

    function draw(t) {
      chans.forEach(function (ch, i) {
        if (ch.kind === "still") { D[i] = 0; return; }
        var q = Math.min(1, Math.max(0, (t - ch.start) / ch.dur));
        D[i] = ch.kind === "sink" ? q * q * q : Math.pow(1 - q, 3);
      });
      gl.uniform1fv(uD, D);
      gl.uniform1f(uTime, t / 1000);
      var x = Math.min(1, t / total);
      gl.uniform1f(uSwell, 0.55 * Math.pow(Math.sin(Math.PI * x), 2));
      gl.uniform1f(uFade, Math.min(1, Math.max(0, (total - t) / 600)));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    document.body.appendChild(canvas);
    draw(0);
    root.classList.add("is-emerging", "is-water"); // DOM swaps under frame 0
    if (location.hash === "#water-test") { // frame-by-frame inspection
      window.dzWater = { draw: draw, total: total };
      return true;
    }
    var t0 = performance.now();
    (function frame() {
      var t = performance.now() - t0;
      draw(Math.min(t, total));
      if (t < total) return requestAnimationFrame(frame);
      canvas.remove();
      root.classList.remove("is-water");
      var lose = gl.getExtension("WEBGL_lose_context");
      if (lose) lose.loseContext();
      cleanup();
    })();
    return true;
  }

  requestAnimationFrame(tick);
})();
