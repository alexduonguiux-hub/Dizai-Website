/* Home → Work, driven by scroll (Figma Home → Work-01 → Work-02 → Work-03).
   Desktop only (≥ 721 px); on small screens Work simply follows Home.

   The page is one pinned stage; scrolling through the spacer below it moves
   a progress value p from 0 (Home) to 1 (Work-03), and every element is a
   pure function of p, so scrolling back plays it all in reverse.

     0.00–0.26  text that only Home has soaks back into the paper
     0.04–0.30  what both pages share moves to its Work place: the contact
                block slides to the top, the seal shrinks to the top centre
                and turns into the small "đs" mark; the menu marks WORK
     0.22–0.38  WORK prints in (ink soak) low on the page — Work-01
     0.42–0.62  scrolling on pushes WORK up to the top, turning light green;
                the mark leaves; the first project slides in — Work-02
     0.62–0.94  the other projects follow — Work-03

   Project images hang like sheets of paper pinned at the top: they sway a
   little on their own and swing with the speed of the scroll. */
(function () {
  "use strict";

  var root = document.documentElement;
  var mq = window.matchMedia("(min-width: 721px)");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var stage = document.querySelector(".stage");
  var work = document.querySelector(".work");
  if (!stage || !work) return;

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function seg(p, a, b) { return clamp01((p - a) / (b - a)); }
  function ease(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function easeOut(x) { return 1 - Math.pow(1 - x, 3); }

  /* ---------- ink soak (same look as the loading hand-off) ---------- */

  var NS = "http://www.w3.org/2000/svg";
  var svg = document.createElementNS(NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
  document.body.appendChild(svg);
  var uid = 0;
  function node(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    parent.appendChild(n);
    return n;
  }
  var S = 8, I_HIDDEN = -S * 1.25, I_SHOWN = 1;
  /* Returns set(v): v = 1 fully printed (no filter at all), 0 gone.
     shown: the opacity to leave when printed ("" = the stylesheet's). */
  function soak(el, shown) {
    shown = shown || "";
    var h = Math.max(el.getBoundingClientRect().height, 40);
    var f = node("filter", { id: "dz-wsoak-" + (uid++), x: "-5%", y: "-10%", width: "110%", height: "120%",
                             "color-interpolation-filters": "sRGB" }, svg);
    node("feTurbulence", { type: "fractalNoise", baseFrequency: Math.min(0.09, 0.022 * Math.max(1, 231 / h)).toFixed(4),
                           numOctaves: "3", seed: String(17 + uid * 13), result: "fibre" }, f);
    node("feColorMatrix", { "in": "fibre", type: "matrix", result: "fibreA",
                            values: "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" }, f);
    node("feGaussianBlur", { "in": "SourceAlpha", stdDeviation: Math.max(1.2, h * 0.02).toFixed(2), result: "core" }, f);
    node("feComposite", { "in": "fibreA", in2: "core", operator: "arithmetic",
                          k1: "0", k2: "0.45", k3: "0.75", k4: "0", result: "mix" }, f);
    var ct = node("feComponentTransfer", { "in": "mix", result: "level" }, f);
    var fa = node("feFuncA", { type: "linear", slope: String(S), intercept: String(I_HIDDEN) }, ct);
    node("feComposite", { "in": "SourceGraphic", in2: "level", operator: "in" }, f);
    var url = "url(#" + f.id + ")", last = -1;
    return function (v) {
      v = clamp01(v);
      if (v === last) return;
      last = v;
      if (v >= 1) { el.style.filter = ""; el.style.opacity = shown; return; }
      if (v <= 0) { el.style.filter = ""; el.style.opacity = "0"; return; }
      el.style.opacity = "1";
      el.style.filter = url;
      fa.setAttribute("intercept", (I_HIDDEN + (I_SHOWN - I_HIDDEN) * easeOut(v)).toFixed(3));
    };
  }

  /* ---------- elements ---------- */

  var q = function (s) { return document.querySelector(s); };
  var homeOnly = [".line-design", ".line-studio", ".line-est", ".line-year",
                  ".services", ".scroll-hint", ".social"].map(q).filter(Boolean);
  var contact = q(".hero .contact");
  var seal = q(".type-row .seal");
  var mark = q(".work-mark");
  var title = q(".work-title");
  var cards = [].slice.call(document.querySelectorAll(".work-card"));
  var navHome = q('.nav-list a[data-go="home"]');
  var navWork = q('.nav-list a[data-go="work"]');

  var on = false, soaks = null, unit = 1, m = null;

  function measure() {
    // clear what we move, then measure the resting layout
    [contact, seal, title].concat(cards).forEach(function (el) { if (el) el.style.transform = ""; });
    unit = work.getBoundingClientRect().width / 1432;
    var sr = seal.getBoundingClientRect(), mr = mark.getBoundingClientRect();
    // the seal's inner oval (where the "đs" mark sits): centre and height as
    // fractions of the seal's box, from the Figma artwork
    var s = mr.height / (sr.height * 0.6084);
    m = {
      s: s,
      dx: (mr.left + mr.width / 2) - sr.left - 0.4974 * sr.width * s,
      dy: (mr.top + mr.height / 2) - sr.top - 0.5014 * sr.height * s
    };
  }

  function enable() {
    if (on) return;
    on = true;
    root.classList.add("has-scrub");
    if (!soaks) soaks = { home: homeOnly.map(function (el) { return soak(el); }), title: soak(title, "1") };
    measure();
    render(current, true);
  }
  function disable() {
    if (!on) return;
    on = false;
    root.classList.remove("has-scrub");
    // hand everything back to the stylesheet
    homeOnly.concat([contact, seal, mark, title]).concat(cards).forEach(function (el) {
      if (!el) return;
      el.style.transform = el.style.opacity = el.style.filter = el.style.color = "";
    });
  }

  /* ---------- paper sway ---------- */

  var sway = cards.map(function (c, i) {
    return { a: c.querySelector("a"), rx: 0, vx: 0, rz: 0, vz: 0, ph: i * 1.7 };
  });
  var lastY = window.scrollY, wind = 0;

  function swayStep(dt, t) {
    var vy = window.scrollY - lastY; lastY = window.scrollY;
    // gusts from scrolling, easing off
    wind += (Math.max(-80, Math.min(80, vy)) - wind) * 0.35;
    wind *= 0.95;
    sway.forEach(function (s) {
      var breeze = reduce ? 0 : Math.sin(t * 0.0011 + s.ph) * 2.2 + Math.sin(t * 0.0023 + s.ph * 2) * 0.9;
      var targetX = breeze + Math.max(-14, Math.min(14, wind * 0.3)); // swing on the pin
      var targetZ = Math.sin(t * 0.0008 + s.ph) * 0.9 + wind * 0.05;
      // damped springs, so a gust overshoots a little and settles
      s.vx += (targetX - s.rx) * 0.12 * dt; s.vx *= Math.pow(0.84, dt); s.rx += s.vx * dt;
      s.vz += (targetZ - s.rz) * 0.09 * dt; s.vz *= Math.pow(0.86, dt); s.rz += s.vz * dt;
      var ry = Math.sin(t * 0.0013 + s.ph * 1.3) * 1.5 + wind * 0.08;
      s.a.style.transform = "perspective(900px) rotateX(" + (-s.rx).toFixed(2) + "deg) rotateY(" +
        ry.toFixed(2) + "deg) rotateZ(" + s.rz.toFixed(2) + "deg)";
      // light on the sheet follows its tilt
      s.a.style.setProperty("--sheen", (0.5 + s.rx * 0.03).toFixed(3));
    });
  }

  /* ---------- progress → layout ---------- */

  var target = 0, current = 0;
  function progress() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    return max > 0 ? clamp01(window.scrollY / max) : 0;
  }

  function mixColor(a, b, k) {
    return "rgb(" + [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * k); }).join(",") + ")";
  }
  var DARK = [0x21, 0x50, 0x28], LIGHT = [0x74, 0x96, 0x74];

  function render(p) {
    // Home-only text soaks away, one after another
    soaks.home.forEach(function (set, i) { set(1 - seg(p, i * 0.02, 0.12 + i * 0.02)); });

    // shared: contact slides up to the top (251 units)
    var mv = ease(seg(p, 0.04, 0.30));
    contact.style.transform = mv ? "translateY(" + (-251 * unit * mv).toFixed(2) + "px)" : "";

    // shared: the seal flies to the top centre, then becomes the small mark
    seal.style.transformOrigin = "0 0";
    var s = 1 + (m.s - 1) * mv;
    seal.style.transform = mv ? "translate(" + (m.dx * mv).toFixed(2) + "px," + (m.dy * mv).toFixed(2) + "px) scale(" + s.toFixed(4) + ")" : "";
    var swap = seg(p, 0.22, 0.32);
    seal.style.opacity = swap ? String(1 - swap) : "";
    var markOut = seg(p, 0.42, 0.52);
    mark.style.opacity = String(Math.max(0, swap - markOut));

    // menu: WORK becomes the current page halfway through
    var atWork = p >= 0.18;
    if (atWork !== (navWork.getAttribute("aria-current") === "page")) {
      navWork.toggleAttribute("aria-current", atWork); if (atWork) navWork.setAttribute("aria-current", "page");
      navHome.toggleAttribute("aria-current", !atWork); if (!atWork) navHome.setAttribute("aria-current", "page");
    }

    // WORK prints in low (Work-01), then is pushed up and lightens (Work-02)
    soaks.title(seg(p, 0.22, 0.38));
    var up = ease(seg(p, 0.42, 0.62));
    title.style.transform = "translateY(" + (502 * unit * (1 - up)).toFixed(2) + "px)";
    title.style.color = mixColor(DARK, LIGHT, up);

    // projects slide in with the scroll: the right one first, then the rest
    var windows = [[0.66, 0.82], [0.72, 0.88], [0.78, 0.94], [0.48, 0.66]];
    cards.forEach(function (c, i) {
      var k = easeOut(seg(p, windows[i][0], windows[i][1]));
      c.style.opacity = String(k);
      c.style.transform = "translateY(" + ((1 - k) * window.innerHeight * 0.7).toFixed(1) + "px)";
      c.classList.toggle("is-on", k > 0.6);
    });
  }

  var lastT = performance.now();
  function loop(t) {
    var dt = Math.min(3, (t - lastT) / 16.67); lastT = t;
    if (on && !root.classList.contains("is-loading")) {
      target = progress();
      // a touch of inertia, so wheel steps glide
      current += (target - current) * (reduce ? 1 : Math.min(1, 0.16 * dt));
      if (Math.abs(target - current) < 0.0004) current = target;
      render(current);
      swayStep(dt, t);
    }
    requestAnimationFrame(loop);
  }

  /* ---------- menu ---------- */

  document.querySelectorAll(".nav-list a[data-go]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      if (!on) return; // small screens: the plain #anchors do the job
      e.preventDefault();
      var max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: a.dataset.go === "work" ? max : 0, behavior: reduce ? "auto" : "smooth" });
    });
  });

  function sync() { if (mq.matches) enable(); else disable(); }
  mq.addEventListener ? mq.addEventListener("change", sync) : mq.addListener(sync);
  window.addEventListener("resize", function () { if (on) { measure(); render(current); } });
  window.scrollTo(0, 0);
  sync();
  requestAnimationFrame(loop);
})();
