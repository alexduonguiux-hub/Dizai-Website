/* Home → Work, driven by scroll (Figma Home → Work-01 → Work-02 → Work-03).
   Desktop only (≥ 721 px); on small screens Work simply follows Home.

   The page is one pinned stage. Scrolling moves it through, in viewport
   heights (V) of scroll:

     0    – 0.6 V  text and seal that only Home has soak back into the paper
     0.1  – 0.7 V  the contact block slides to its Work place; the menu marks
                   WORK at 0.45 V
     0.5  – 0.85V  WORK and Work's own small "đs" mark print in — Work-01
     1.0  – 1.6 V  WORK is pushed up to the top and lightens; the mark leaves;
                   the first project arrives from the right — Work-02
     1.6 V →       the projects travel right to left along a gentle wave, as
                   an endless carousel (Work-03 is where four are in view);
                   the scroll wraps round so it never runs out

   Everything is a function of the (smoothed) scroll position, so scrolling
   back plays it in reverse. Project images hang like sheets of paper pinned
   at the top: they sway on their own and swing with the speed of scroll. */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var stage = document.querySelector(".stage");
  var work = document.querySelector(".work");
  if (!stage || !work) return;

  if (!window.gsap || !window.ScrollTrigger) return; // GSAP missing: Work stays a plain section
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

  /* Paper-fibre noise, drawn once into a small tile and repeated (feImage +
     feTile). Generating turbulence inside the filter on every scroll frame
     was what made the scroll stutter. Smoothed value noise, 3 octaves. */
  var tileCache = {};
  function noiseTile(size) {
    if (tileCache[size]) return tileCache[size];
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var x = c.getContext("2d");
    x.fillStyle = "#808080"; x.fillRect(0, 0, size, size);
    [[8, 0.55], [16, 0.3], [32, 0.15]].forEach(function (o) {
      var n = o[0], small = document.createElement("canvas");
      small.width = small.height = n;
      var sx = small.getContext("2d"), img = sx.createImageData(n, n);
      for (var i = 0; i < n * n; i++) {
        var v = Math.random() * 255;
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
      }
      sx.putImageData(img, 0, 0);
      x.globalAlpha = o[1];
      x.imageSmoothingEnabled = true;
      // draw 3×3 so the smoothed tile wraps without seams
      for (var a = -1; a <= 1; a++) for (var b = -1; b <= 1; b++) x.drawImage(small, a * size, b * size, size, size);
    });
    return (tileCache[size] = c.toDataURL("image/png"));
  }
  /* Returns set(v): v = 1 fully printed (no filter at all), 0 gone.
     shown: the opacity to leave when printed ("" = the stylesheet's). */
  function soak(el, shown) {
    shown = shown || "";
    var h = Math.max(el.getBoundingClientRect().height, 40);
    var f = node("filter", { id: "dz-wsoak-" + (uid++), x: "-5%", y: "-10%", width: "110%", height: "120%",
                             "color-interpolation-filters": "sRGB" }, svg);
    // blotch size follows the type size (a 330 px line gets ~360 px tiles)
    var T = Math.max(48, Math.round(h * 1.55));
    var fe = node("feImage", { x: "0", y: "0", width: String(T), height: String(T),
                               preserveAspectRatio: "none", result: "tile" }, f);
    fe.setAttribute("href", noiseTile(128));
    fe.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", noiseTile(128));
    node("feTile", { "in": "tile", result: "fibre" }, f);
    node("feColorMatrix", { "in": "fibre", type: "matrix", result: "fibreA",
                            values: "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" }, f);
    // no blur here (unlike the loading hand-off): this filter is re-run while
    // scrolling, so the ink comes and goes by paper-fibre blotches alone
    node("feComposite", { "in": "fibreA", in2: "SourceAlpha", operator: "arithmetic",
                          k1: "0", k2: "0.75", k3: "0.45", k4: "0", result: "mix" }, f);
    var ct = node("feComponentTransfer", { "in": "mix", result: "level" }, f);
    var fa = node("feFuncA", { type: "linear", slope: String(S), intercept: String(I_HIDDEN) }, ct);
    node("feComposite", { "in": "SourceGraphic", in2: "level", operator: "in" }, f);
    var url = "url(#" + f.id + ")", last = -1;
    return function (v) {
      v = clamp01(v);
      if (v === last) return;
      // re-filter only on a visible change; ends always land exactly
      if (v > 0 && v < 1 && last > 0 && last < 1 && Math.abs(v - last) < 0.045) return;
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
  var homeOnly = [".line-design", ".line-studio", ".type-row .seal", ".line-est", ".line-year",
                  ".services", ".scroll-hint", ".social"].map(q).filter(Boolean);
  var contact = q(".hero .contact");
  var mark = q(".work-mark");
  var title = q(".work-title");
  var list = q(".work-list");
  var navHome = q('.nav-list a[data-go="home"]');
  var navWork = q('.nav-list a[data-go="work"]');

  // the carousel needs eight sheets to fill the loop; extra ones are copies
  var originals = [].slice.call(list.querySelectorAll(".work-card"));
  var cards = originals.slice();
  for (var ci = 0; cards.length < 8; ci++) {
    var clone = originals[ci % originals.length].cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    clone.querySelector("a").setAttribute("tabindex", "-1");
    list.appendChild(clone);
    cards.push(clone);
  }

  var on = false, soaks = null, unit = 1, H = 733;

  /* Layout per screen size, in units of the content width (G.W).
     Desktop is Figma Work-01/02/03. Mobile has no Work frame in Figma yet:
     the same story on the 358 grid of mobile Home — WORK (118) prints in at
     the bottom, rises under the contact block, and one sheet at a time
     rides the wave across the screen. */
  var DESK = { W: 1432, pitch: 368, cardW: 328, rest0: 1104, navAt: 1104,
               wave: [275, 379, 320, 275], contactY: -251,
               titleFrom: function () { return 502; }, titleTo: 0 };
  var MOB = { W: 358, pitch: 272, cardW: 240, rest0: 59, navAt: 0,
              waveOff: [0, 70, 30, 0], contactY: 0,
              titleFrom: function () { return H - 83; }, titleTo: 132 };
  var G = DESK;

  function measure() {
    var r = work.getBoundingClientRect(); // transforms are GSAP's
    unit = r.width / G.W;
    H = r.height / unit;
    if (G.wave) WAVE = G.wave;
    else { // mobile: the wave sits in the room left under WORK
      var top = G.titleTo + 83, base = top + Math.max(24, (H - top - G.cardW - 70) / 2);
      WAVE = G.waveOff.map(function (d) { return base + d; });
    }
    PITCH = G.pitch; SPAN = PITCH * LOOP_CARDS;
    if (typeof sizeSheets === "function") sizeSheets();
  }

  function enable() {
    if (on) return;
    on = true;
    root.classList.add("has-scrub");
    if (!soaks) soaks = { home: homeOnly.map(function (el) { return soak(el); }), title: soak(title, "1"), mark: soak(mark, "1") };
    measure();
  }
  function disable() {
    if (!on) return;
    on = false;
    root.classList.remove("has-scrub");
    homeOnly.concat([contact, mark, title]).concat(cards).forEach(function (el) {
      if (!el) return;
      el.style.transform = el.style.opacity = el.style.filter = el.style.color = "";
    });
  }

  /* ---------- paper flutter ----------
     Each image becomes a hanging sheet made of STRIPS horizontal bands,
     nested so that every band hinges on the bottom edge of the one above.
     Small per-band angles add up into a real bend: a wave runs down from
     the pinned top edge, and scrolling blows the free end up, after which
     it ripples and settles. */

  var STRIPS = 18;
  var sheets = cards.map(function (c, i) {
    var a = c.querySelector("a"), img = a.querySelector("img");
    var src = img.currentSrc || img.src;
    var sheet = document.createElement("span");
    sheet.className = "sheet";
    sheet.style.setProperty("--n", STRIPS);
    sheet.setAttribute("aria-hidden", "true");
    var parent = sheet, bands = [];
    for (var k = 0; k < STRIPS; k++) {
      var band = document.createElement("span");
      band.className = "sheet-band";
      band.style.backgroundImage = "url(\"" + src + "\")";
      band.style.backgroundPosition = "0 calc(var(--bh) * " + (-k) + ")";
      parent.appendChild(band);
      bands.push(band);
      parent = band;
    }
    a.appendChild(sheet);
    a.classList.add("has-sheet");
    return { sheet: sheet, a: a, bands: bands, ph: i * 1.9, swing: 0, vswing: 0 };
  });
  // band height in px (bands overlap a hair so no seams open as they bend)
  function sizeSheets() {
    sheets.forEach(function (sh) {
      sh.sheet.style.setProperty("--bh", (sh.a.getBoundingClientRect().height / STRIPS).toFixed(3) + "px");
    });
  }
  var lastY = window.scrollY, wind = 0;

  function swayStep(dt, t) {
    var vy = window.scrollY - lastY; lastY = window.scrollY;
    // gusts from scrolling, easing off
    wind += (Math.max(-90, Math.min(90, vy)) - wind) * 0.3;
    wind *= 0.94;
    var sec = t / 1000;
    sheets.forEach(function (sh) {
      // the whole sheet swings on its pin with a little lag (damped spring)
      var gust = Math.max(-1, Math.min(1, wind / 40));
      sh.vswing += (gust * 10 - sh.swing) * 0.08 * dt; sh.vswing *= Math.pow(0.86, dt); sh.swing += sh.vswing * dt;
      for (var k = 0; k < STRIPS; k++) {
        var f = k / (STRIPS - 1);            // 0 at the pin, 1 at the free end
        // breeze: a wave travelling down the sheet, stronger towards the end
        var per = 12 / STRIPS; // angles were tuned for 12 bands
        var wave = reduce ? 0 : (Math.sin(sec * 2.1 + sh.ph - k * 0.55 * per) * (0.6 + 2.2 * f)
                              + Math.sin(sec * 3.4 + sh.ph * 1.7 - k * 0.9 * per) * 0.5 * f) * per;
        // gust: the free end lifts most, the top barely moves
        var ang = (k === 0 ? sh.swing * 0.6 : 0) + wave + sh.swing * 0.55 * f * per;
        // a sideways S-curve, so the flutter reads face-on (no twist: bands of
        // different widths would show steps along the edges)
        var side = reduce ? 0 : (Math.sin(sec * 1.5 + sh.ph - k * 0.45 * per) * 0.5 * (0.3 + f) + sh.swing * 0.03) * per;
        var b = sh.bands[k];
        b.style.transform = "rotateX(" + (-ang).toFixed(2) + "deg) rotateZ(" + side.toFixed(2) + "deg)";
      }
    });
  }

  /* ---------- the carousel's wave ---------- */

  // Card tops in Work-03 (units of 1432, card lefts 0 / 368 / 736 / 1104):
  // 275, 379, 320, 275. A periodic Catmull-Rom curve through them, repeating
  // every 4 cards, is the wave the sheets ride along.
  var PITCH = 368, WAVE = [275, 379, 320, 275], LOOP_CARDS = 8, SPAN = PITCH * LOOP_CARDS;
  // (mobile: PITCH / WAVE are set by measure())
  function waveY(x) {
    var n = WAVE.length, t = x / PITCH, i = Math.floor(t), f = t - i;
    function P(k) { return WAVE[((k % n) + n) % n]; }
    var p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    return 0.5 * ((2 * p1) + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f);
  }

  /* ---------- GSAP: the scroll timeline ---------- */

  var gsap = window.gsap;
  gsap.registerPlugin(window.ScrollTrigger, window.CustomEase, window.ScrollToPlugin);
  var ScrollTrigger = window.ScrollTrigger;

  /* The motion curves. Each is an SVG path in a 0–1 box, exactly as an
     animation graph draws it: paste a curve from Figma / After Effects /
     the GSAP ease visualiser here and the motion follows it. */
  window.CustomEase.create("dz.move", "M0,0 C0.62,0 0.28,1 1,1");   // things travelling: slow–fast–slow
  window.CustomEase.create("dz.nav", "M0,0 C0.7,0 0.25,1 1,1");     // menu jumps (a touch longer at both ends)

  var V = window.innerHeight;
  var PITCH_V = 0.35;            // V of scroll per card on the carousel
  var RATE = PITCH / PITCH_V;    // carousel units per V (set per layout)
  var CAROUSEL_AT = 1.6;         // V: Work-02
  var WORK03 = CAROUSEL_AT;      // where the menu's WORK lands (set per layout)
  // the wrap-round zone (all eight sheets have entered by then)
  var LO = 3.4, LOOP = LOOP_CARDS * PITCH_V, HI = LO + LOOP;
  var loops = 0;

  var DARK = "#215028", LIGHT = "#749674";
  var mm = gsap.matchMedia();
  var smooth = { y: 0 };   // the carousel's own smoothed scroll (it runs past the timeline)

  window.ScrollTrigger.config({ ignoreMobileResize: true }); // phone URL bar: no re-layout

  mm.add({ desk: "(min-width: 721px)", mob: "(max-width: 720px)" }, function (ctx) {
    G = ctx.conditions.desk ? DESK : MOB;
    V = window.innerHeight;
    enable();
    RATE = G.pitch / PITCH_V;
    WORK03 = CAROUSEL_AT + G.navAt / RATE;
    loops = 0; smooth.y = window.scrollY; lastCards = -1;
    // the timeline's time is measured in V (viewport heights of scroll)
    var tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: document.body,
        start: 0,
        end: function () { return CAROUSEL_AT * V; },
        scrub: reduce ? true : 0.6,      // GSAP's smoothing replaces our inertia
        invalidateOnRefresh: true
      },
      onUpdate: function () {
        var atWork = this.time() >= 0.45;
        if (atWork !== (navWork.getAttribute("aria-current") === "page")) {
          if (atWork) { navWork.setAttribute("aria-current", "page"); navHome.removeAttribute("aria-current"); }
          else { navHome.setAttribute("aria-current", "page"); navWork.removeAttribute("aria-current"); }
        }
      }
    });

    function soakTween(set, from, to, at, dur) {
      var o = { v: from };
      set(from);
      tl.to(o, { v: to, duration: dur, onUpdate: function () { set(o.v); } }, at);
    }

    // text and seal only Home has: soak away, one after another
    soaks.home.forEach(function (set, i) { soakTween(set, 1, 0, i * 0.04, 0.3); });
    // the contact block slides up to its Work place (desktop: 251 units;
    // mobile: it is already there)
    if (G.contactY) tl.fromTo(contact, { y: 0 }, { y: function () { return G.contactY * unit; }, duration: 0.6, ease: "dz.move" }, 0.1);
    // WORK and the small mark print in — Work-01
    soakTween(soaks.title, 0, 1, 0.5, 0.35);
    soakTween(soaks.mark, 0, 1, 0.55, 0.3);
    // scroll on: WORK is pushed to the top and lightens, the mark leaves — Work-02
    tl.fromTo(title, { y: function () { return G.titleFrom() * unit; }, color: DARK },
                     { y: function () { return G.titleTo * unit; }, color: LIGHT, duration: 0.6, ease: "dz.move" }, 1.0);
    var mk = { v: 1 };
    tl.to(mk, { v: 0, duration: 0.2, onUpdate: function () { soaks.mark(mk.v); } }, 1.0);
    tl.set({}, {}, CAROUSEL_AT); // timeline length = CAROUSEL_AT V

    var onRefresh = function () { V = window.innerHeight; measure(); };
    ScrollTrigger.addEventListener("refreshInit", onRefresh);
    gsap.ticker.add(tick);

    return function () { // leaving desktop: undo everything
      gsap.ticker.remove(tick);
      ScrollTrigger.removeEventListener("refreshInit", onRefresh);
      disable();
    };
  });

  /* ---------- the carousel (past the timeline, endless) ---------- */

  function placeCards(v) {
    // carousel offset (units): 0 at Work-02, 1104 at Work-03, on and on after
    var o = (v - CAROUSEL_AT) * RATE;
    cards.forEach(function (c, k) {
      // card k waits off screen to the right until its turn; from then on
      // it goes round the loop
      var x = G.rest0 + k * PITCH - o;
      var entered = x < SPAN - PITCH;
      if (entered) x = ((x + PITCH) % SPAN + SPAN) % SPAN - PITCH;
      var show = entered && x > -PITCH && x < G.W + 40;
      c.style.opacity = show ? "1" : "0";
      c.classList.toggle("is-on", show && x > -G.cardW * 0.6 && x < G.W - G.cardW * 0.4);
      if (show) gsap.set(c, { x: x * unit, y: waveY(x) * unit });
    });
  }

  // keep the scroll inside the wrap-round zone once the carousel is running
  function wrap() {
    var y = window.scrollY, d = LOOP * V;
    if (y > HI * V) { jump(-d); loops++; }
    else if (y < LO * V && loops > 0) {
      // scrolling back through the loop wraps; a leap far up (scrollbar,
      // Home key) means "take me back": stop looping and let it go
      if (y > (LO - 0.6) * V) { jump(d); loops--; } else loops = 0;
    }
  }
  function jump(d) {
    window.scrollTo(0, window.scrollY + d);
    smooth.y += d; lastY += d;
  }

  var lastCards = -1;
  function tick(time, deltaTime) {
    if (!on || root.classList.contains("is-loading")) return;
    var dt = Math.min(3, deltaTime / 16.67);
    if (!navTween) wrap();
    // same smoothing feel as the timeline's scrub
    smooth.y += (window.scrollY - smooth.y) * (reduce || navTween ? 1 : Math.min(1, 0.12 * dt));
    if (Math.abs(smooth.y - lastCards) > 0.3) { placeCards(smooth.y / V); lastCards = smooth.y; }
    swayStep(dt, time * 1000);
  }

  /* ---------- menu: scroll along the dz.nav curve ---------- */

  var navTween = null;
  document.querySelectorAll(".nav-list a[data-go]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      if (!on) return; // no GSAP: the plain #anchors do the job
      e.preventDefault();
      loops = 0;
      if (a.dataset.go === "home" && window.scrollY > LO * V) { // far into the loop: go straight
        window.scrollTo(0, LO * V); smooth.y = LO * V; lastY = window.scrollY;
      }
      var to = a.dataset.go === "work" ? WORK03 * V : 0;
      var dist = Math.abs(to - window.scrollY) / V;
      if (navTween) navTween.kill();
      navTween = gsap.to(window, {
        scrollTo: { y: to, autoKill: true },        // the user scrolling takes over
        duration: reduce ? 0 : Math.max(1.2, Math.min(2.6, 0.9 + dist * 0.45)),
        ease: "dz.nav",
        onComplete: function () { navTween = null; },
        onInterrupt: function () { navTween = null; }
      });
    });
  });

  window.scrollTo(0, 0);
})();
