/* Ink bleed on hover ("lem mực in").
   Type is crisp at rest. Hovering a line wets its ink: the edges bleed out
   along the paper fibres, pool in the inside corners and keep creeping
   while the pointer stays; leaving lets the ink draw back until the line is
   crisp again and the filter is removed. Each line has its own filter, so
   lines bleed independently. Mouse/trackpad only, never during loading. */
(function () {
  "use strict";
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var root = document.documentElement;
  var NS = "http://www.w3.org/2000/svg";

  var svg = document.createElementNS(NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
  document.body.appendChild(svg);

  function node(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    parent.appendChild(n);
    return n;
  }

  // strength by type size: big display lines, mobile display, 20px text
  // B blur (spread) and R dilate grow further by up to CREEP× while held
  var TIERS = {
    lg: { F: 0.022, B: 4, N: 0.9, K: -0.45, S: 7, I: -2.6, R: 3, drift: 16 },
    md: { F: 0.05, B: 1.8, N: 0.8, K: -0.4, S: 7, I: -2.6, R: 1.4, drift: 9 },
    sm: { F: 0.15, B: 0.9, N: 0.6, K: -0.3, S: 6, I: -2.2, R: 0.8, drift: 4 }
  };
  var CREEP = 0.45, CREEP_MS = 2500;
  function tierOf(el) {
    var fs = parseFloat(getComputedStyle(el).fontSize);
    return fs >= 160 ? TIERS.lg : fs >= 60 ? TIERS.md : TIERS.sm;
  }

  var uid = 0, active = [];

  /* out = (1 − a)·crisp + a·bled, so a = 0 is exactly the plain glyph.
     The bled version: blurred alpha + fibre noise, thresholded, filled from
     a dilated copy (keeps the colour), with the noise drifting over time. */
  function makeFilter(el, T) {
    var f = node("filter", { id: "dz-wet-" + (uid++), x: "-6%", y: "-20%", width: "112%", height: "140%",
                             "color-interpolation-filters": "sRGB" }, svg);
    var turb = node("feTurbulence", { type: "fractalNoise", baseFrequency: String(T.F), numOctaves: "3",
                                      seed: String(3 + uid * 7), result: "fibre" }, f);
    var off = node("feOffset", { "in": "fibre", dx: "0", dy: "0", result: "flow" }, f);
    var blur = node("feGaussianBlur", { "in": "SourceAlpha", stdDeviation: "0", result: "spread" }, f);
    node("feComposite", { "in": "spread", in2: "flow", operator: "arithmetic",
                          k2: "1", k3: String(T.N), k4: String(T.K), result: "wet" }, f);
    var ct = node("feComponentTransfer", { "in": "wet", result: "edge" }, f);
    node("feFuncA", { type: "linear", slope: String(T.S), intercept: String(T.I) }, ct);
    var dil = node("feMorphology", { "in": "SourceGraphic", operator: "dilate", radius: "0", result: "ink" }, f);
    node("feComposite", { "in": "ink", in2: "edge", operator: "in", result: "spill" }, f);
    // the ink only ever adds to the glyph, so thin strokes never break up
    node("feComposite", { "in": "SourceGraphic", in2: "spill", operator: "over", result: "bled" }, f);
    var mix = node("feComposite", { "in": "SourceGraphic", in2: "bled", operator: "arithmetic",
                                    k1: "0", k2: "1", k3: "0", k4: "0" }, f);
    el.style.filter = "url(#" + f.id + ")";
    return { f: f, turb: turb, off: off, blur: blur, dil: dil, mix: mix };
  }

  function state(el) {
    for (var i = 0; i < active.length; i++) if (active[i].el === el) return active[i];
    return null;
  }

  function enter(el) {
    if (root.classList.contains("is-loading")) return;
    var s = state(el);
    if (!s) {
      var T = tierOf(el);
      s = { el: el, T: T, a: 0, creep: 0, on: true, fx: makeFilter(el, T), phase: Math.random() * 10 };
      active.push(s);
      if (active.length === 1) requestAnimationFrame(tick);
    }
    s.on = true;
  }
  function leave(el) { var s = state(el); if (s) s.on = false; }

  var last = performance.now();
  function tick(now) {
    var dt = Math.min(64, now - last); last = now;
    var t = now / 1000;
    for (var i = active.length - 1; i >= 0; i--) {
      var s = active[i], T = s.T;
      // wet quickly (~0.35 s), dry more slowly (~0.6 s)
      var target = s.on ? 1 : 0, rate = s.on ? 1 / 120 : 1 / 200;
      s.a += (target - s.a) * (1 - Math.exp(-dt * rate));
      if (!s.on && s.a < 0.01) {
        s.el.style.filter = "";
        s.fx.f.remove();
        active.splice(i, 1);
        continue;
      }
      // held: the ink keeps soaking further into the paper; released: it recedes
      s.creep = Math.max(0, Math.min(1, s.creep + (s.on ? dt / CREEP_MS : -dt / 600)));
      var a = s.a, fx = s.fx, grow = 1 + CREEP * s.creep;
      fx.blur.setAttribute("stdDeviation", (T.B * a * grow).toFixed(3));
      fx.dil.setAttribute("radius", (T.R * a * grow).toFixed(3));
      fx.mix.setAttribute("k2", (1 - a).toFixed(4));
      fx.mix.setAttribute("k3", a.toFixed(4));
      if (!reduce) {
        // the ink keeps creeping: the fibre pattern drifts and breathes
        var p = t * 0.9 + s.phase;
        fx.off.setAttribute("dx", (Math.sin(p) * T.drift).toFixed(2));
        fx.off.setAttribute("dy", (Math.cos(p * 0.7) * T.drift * 0.6).toFixed(2));
        fx.turb.setAttribute("baseFrequency", (T.F * (1 + 0.06 * Math.sin(p * 1.3))).toFixed(4));
      }
    }
    if (active.length) requestAnimationFrame(tick);
  }

  var targets = document.querySelectorAll(
    ".display:not(.loader-count), .nav-list li, .services li, .contact, .social li, .scroll-hint");
  targets.forEach(function (el) {
    el.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") enter(el); });
    el.addEventListener("pointerleave", function () { leave(el); });
  });
})();
