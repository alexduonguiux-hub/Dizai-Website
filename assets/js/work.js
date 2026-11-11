/* Home → Work, driven by scroll (Figma Home → Work-01 → Work-02).
   Desktop and mobile share the story; only the layout differs (below).

   The page is one pinned stage. Scrolling moves it through, in viewport
   heights (V) of scroll:

     0    – 0.55V  the letters only Home has roll away, like the loading
                   counter's digits; the seal slides up out of its window
     0.1  – 0.7 V  desktop: the contact block slides up to its Work place;
                   the menu marks WORK at 0.45 V
     0.45 – 0.9 V  WORK rolls in at the bottom, the small "đs" mark slides in
                   (desktop: SCROLL DOWN rolls in) — Work-01
     1.0  – 1.6 V  WORK lightens, SCROLL DOWN rolls away, the first project
                   arrives (desktop: from below; mobile: from the right) and
                   its name rolls in — Work-02
     1.6 V →       the projects keep travelling as an endless list; the
                   scroll wraps round so it never runs out, and the name
                   beside them rolls over to the current project's

   Everything but the names is a function of the (smoothed) scroll
   position, so scrolling back plays it in reverse. The project pictures
   hang like sheets of paper pinned at the top: they sway on their own and
   swing with the speed of scroll. */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var stage = document.querySelector(".stage");
  var work = document.querySelector(".work");
  if (!stage || !work) return;
  if (!window.gsap || !window.ScrollTrigger || !window.DzRoll) return; // Work stays a plain section
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  var gsap = window.gsap, ScrollTrigger = window.ScrollTrigger, Roll = window.DzRoll;
  gsap.registerPlugin(ScrollTrigger, window.CustomEase, window.ScrollToPlugin);

  /* The motion curves. Each is an SVG path in a 0–1 box, exactly as an
     animation graph draws it: paste a curve from Figma / After Effects /
     the GSAP ease visualiser here and the motion follows it. */
  window.CustomEase.create("dz.move", "M0,0 C0.62,0 0.28,1 1,1");   // things travelling: slow–fast–slow
  window.CustomEase.create("dz.nav", "M0,0 C0.7,0 0.25,1 1,1");     // menu jumps (a touch longer at both ends)

  /* ---------- elements ---------- */

  var q = function (s) { return document.querySelector(s); };
  var homeText = [".line-design", ".line-studio", ".line-est", ".line-year",
                  ".services", ".scroll-hint", ".social"].map(q).filter(Boolean);
  var seal = q(".type-row .seal");
  var contact = q(".hero .contact");
  var mark = q(".work-mark");
  var title = q(".work-title");
  var hint = q(".work-hint");
  var caption = q(".work-caption");
  var capName = caption.querySelector(".wc-name"), capDesc = caption.querySelector(".wc-desc");
  var navHome = q('.nav-list a[data-go="home"]');
  var navWork = q('.nav-list a[data-go="work"]');
  var cards = [].slice.call(work.querySelectorAll(".work-card"));
  var N = cards.length;

  /* Layout per screen size, in units of the content width (G.W).
     Desktop: Figma Work-01 10:1481 / Work-02 23:10013 (1432 grid) — a
     column of 573 × 430 pictures 40 apart at x 736, WORK at the bottom
     left. Mobile: Work-01 22:3 / Work-02 22:66 (358 grid) — a row of
     350 × 262 pictures 16 apart, WORK centred at the bottom. */
  var DESK = { W: 1432, axis: "y", pitch: 470, len: 430, pitchV: 0.38,
               titleY: function () { return 502; }, titleY2: function () { return 508; },
               contactY: -251, hint: true };
  var MOB = { W: 358, axis: "x", pitch: 366, len: 350, pitchV: 0.35,
              titleY: function () { return H - 67 - 16; }, titleY2: function () { return H - 67 - 16; },
              contactY: 0, hint: false };
  var G = DESK, unit = 1, H = 733, cardTop = 240;

  function measure() {
    var r = work.getBoundingClientRect(); // transforms are GSAP's
    unit = r.width / G.W;
    H = r.height / unit;
    if (G.axis === "x") {
      // Figma: pictures at 240, name at 534 (61 tall), WORK from H − 83.
      // Short screens: lift them, but keep them under the contact block.
      var room = H - 83 - 24 - (262 + 32 + 61);
      cardTop = Math.max(116 / unit, Math.min(240, room));
      work.style.setProperty("--cap-top", ((cardTop + 262 + 32) * unit).toFixed(1) + "px");
    } else work.style.removeProperty("--cap-top");
    if (typeof sizeSheets === "function") sizeSheets();
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
      band.style.backgroundPosition = "var(--bgx, 0px) calc(var(--bh) * " + (-k) + " + var(--bgy, 0px))";
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
      var r = sh.a.getBoundingClientRect(), img = sh.a.querySelector("img");
      var ratio = (img.naturalWidth / img.naturalHeight) || (img.width / img.height) || 1;
      // cover: fill the card, crop the overflow evenly
      var bw = r.width, bh = r.width / ratio;
      if (bh < r.height) { bh = r.height; bw = r.height * ratio; }
      var st = sh.sheet.style;
      st.setProperty("--bh", (r.height / STRIPS).toFixed(3) + "px");
      st.setProperty("--bgw", bw.toFixed(2) + "px");
      st.setProperty("--bgh", bh.toFixed(2) + "px");
      st.setProperty("--bgx", ((r.width - bw) / 2).toFixed(2) + "px");
      st.setProperty("--bgy", ((r.height - bh) / 2).toFixed(2) + "px");
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


  /* ---------- rolling letters ---------- */

  var outs = homeText.map(function (el) { return Roll.text(el, "out"); });
  var sealOut = seal ? Roll.box(seal, "out") : { set: function () {} };
  var titleIn = Roll.text(title, "in");
  var markIn = Roll.box(mark, "in");
  var hintIn = hint ? Roll.text(hint, "in") : null, hintOut = hint ? Roll.text(hint, "out") : null;

  function showTitle(v) { title.classList.toggle("is-on", v > 0); titleIn.set(v); }
  function showMark(v) { mark.classList.toggle("is-on", v > 0); markIn.set(v); }
  // SCROLL DOWN rolls in (h 0 → 1), then away (1 → 2)
  function showHint(h) {
    if (!hint) return;
    hint.classList.toggle("is-on", h > 0 && h < 2);
    if (h <= 1) { hintOut.set(0); hintIn.set(h); } else { hintIn.set(1); hintOut.set(h - 1); }
  }

  /* the current project's name: rolls away, then the next one rolls in */
  var capCur = -1, capWant = -1, capBusy = false;
  caption.style.visibility = "hidden";
  function showCaption(k) { capWant = k; if (!capBusy) capStep(); }
  function capStep() {
    if (capWant === capCur) return;
    capBusy = true;
    var next = capWant;
    function roll(dir, dur, done) {
      var r = Roll.text(caption, dir), o = { v: 0 };
      r.set(0);
      gsap.to(o, { v: 1, duration: reduce ? 0.01 : dur, ease: "none",
                   onUpdate: function () { r.set(o.v); }, onComplete: function () { done(r); } });
    }
    function rollIn() {
      capCur = -1;
      if (next < 0) { capBusy = false; return capStep(); }
      capName.textContent = cards[next].dataset.name || "";
      capDesc.textContent = cards[next].dataset.desc || "";
      caption.style.visibility = "";
      roll("in", 0.55, function () { capCur = next; capBusy = false; capStep(); });
    }
    if (capCur >= 0) roll("out", 0.35, function (r) { r.revert(); caption.style.visibility = "hidden"; rollIn(); });
    else rollIn();
  }

  /* ---------- the endless list ---------- */

  var V = window.innerHeight;
  var RATE = G.pitch / G.pitchV;   // list units per V of scroll
  var ENTER_AT = 1.0, LIST_AT = 1.6; // V: the first picture sets off / is in place (Work-02)
  var CAPTION_AT = 1.35;
  var LO = LIST_AT + 0.8, LOOP = N * G.pitchV, HI = LO + LOOP;
  var loops = 0, on = false;
  var smooth = { y: 0 };

  function placeCards(v) {
    var span = G.pitch * N;
    // list offset (units): 0 at Work-02, growing as you scroll on; before
    // that the first picture travels in from just off screen
    var start = G.axis === "y" ? H : G.W;
    var o = v >= LIST_AT ? (v - LIST_AT) * RATE : -start * Math.min(1, (LIST_AT - v) / (LIST_AT - ENTER_AT)) - (v < ENTER_AT ? 1e5 : 0);
    var active = -1, best = 1e9;
    cards.forEach(function (c, k) {
      var p = k * G.pitch - o;
      if (o >= 0) p = ((p + G.pitch) % span + span) % span - G.pitch;
      var max = G.axis === "y" ? H : G.W;
      var show = p > -G.len && p < max;
      c.style.opacity = show ? "1" : "0";
      c.classList.toggle("is-on", show);
      if (show) {
        if (G.axis === "y") gsap.set(c, { x: 0, y: p * unit });
        else gsap.set(c, { x: p * unit, y: cardTop * unit });
      }
      if (Math.abs(p) < best) { best = Math.abs(p); active = k; }
    });
    return active;
  }

  // keep the scroll inside the wrap-round zone once the list is running
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

  var lastCards = -1, navTween = null;
  function tick(time, deltaTime) {
    if (!on || root.classList.contains("is-loading")) return;
    var dt = Math.min(3, deltaTime / 16.67);
    if (!navTween) wrap();
    // same smoothing feel as the timeline's scrub
    smooth.y += (window.scrollY - smooth.y) * (reduce || navTween ? 1 : Math.min(1, 0.12 * dt));
    var v = smooth.y / V;
    if (Math.abs(smooth.y - lastCards) > 0.3) {
      var active = placeCards(v); lastCards = smooth.y;
      showCaption(v >= CAPTION_AT ? active : -1);
    }
    swayStep(dt, time * 1000);
  }

  /* ---------- GSAP: the scroll timeline ---------- */

  var DARK = "#215028", LIGHT = "#749674";
  var mm = gsap.matchMedia();
  ScrollTrigger.config({ ignoreMobileResize: true }); // phone URL bar: no re-layout

  mm.add({ desk: "(min-width: 721px)", mob: "(max-width: 720px)" }, function (ctx) {
    G = ctx.conditions.desk ? DESK : MOB;
    V = window.innerHeight;
    on = true;
    root.classList.add("has-scrub");
    measure();
    RATE = G.pitch / G.pitchV; LOOP = N * G.pitchV; HI = LO + LOOP;
    loops = 0; smooth.y = window.scrollY; lastCards = -1;

    // the timeline's time is measured in V (viewport heights of scroll)
    var tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: document.body,
        start: 0,
        end: function () { return LIST_AT * V; },
        scrub: reduce ? true : 0.6,      // GSAP's smoothing
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
    function drive(fn, from, to, at, dur) {
      var o = { v: from };
      fn(from);
      tl.to(o, { v: to, duration: dur, onUpdate: function () { fn(o.v); } }, at);
    }

    // the letters only Home has roll away, one line after another
    outs.forEach(function (r, i) { drive(r.set, 0, 1, i < 4 ? i * 0.06 : 0.04 + (i - 4) * 0.04, i < 4 ? 0.4 : 0.3); });
    drive(sealOut.set, 0, 1, 0.12, 0.35);
    // desktop: the contact block slides up to its Work place (251 units)
    if (G.contactY) tl.fromTo(contact, { y: 0 }, { y: function () { return G.contactY * unit; }, duration: 0.6, ease: "dz.move" }, 0.1);
    // Work-01: WORK rolls in at the bottom, the mark slides in
    gsap.set(title, { y: function () { return G.titleY() * unit; }, color: DARK });
    drive(showTitle, 0, 1, 0.45, 0.45);
    drive(showMark, 0, 1, 0.55, 0.3);
    if (G.hint) drive(showHint, 0, 1, 0.6, 0.3); else showHint(0);
    // Work-02: WORK lightens (desktop: settles 6 units lower), SCROLL DOWN leaves
    tl.fromTo(title, { y: function () { return G.titleY() * unit; }, color: DARK },
                     { y: function () { return G.titleY2() * unit; }, color: LIGHT, duration: 0.6, ease: "dz.move" }, 1.0);
    if (G.hint) drive(showHint, 1, 2, 1.0, 0.25);
    tl.set({}, {}, LIST_AT); // timeline length = LIST_AT V

    var onRefresh = function () { V = window.innerHeight; measure(); lastCards = -1; };
    ScrollTrigger.addEventListener("refreshInit", onRefresh);
    gsap.ticker.add(tick);

    return function () { // leaving this layout: undo everything
      gsap.ticker.remove(tick);
      ScrollTrigger.removeEventListener("refreshInit", onRefresh);
      on = false;
      root.classList.remove("has-scrub");
      outs.forEach(function (r) { r.set(0); });
      sealOut.set(0); titleIn.revert(); markIn.set(1); showHint(0);
      [contact, title, mark].concat(cards).forEach(function (el) {
        el.style.transform = el.style.opacity = el.style.color = "";
      });
      title.classList.remove("is-on"); mark.classList.remove("is-on");
      showCaption(-1);
    };
  });

  /* ---------- menu: scroll along the dz.nav curve ---------- */

  document.querySelectorAll(".nav-list a[data-go]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      if (!on) return; // no GSAP: the plain #anchors do the job
      e.preventDefault();
      loops = 0;
      if (a.dataset.go === "home" && window.scrollY > LO * V) { // far into the loop: go straight
        window.scrollTo(0, LO * V); smooth.y = LO * V; lastY = window.scrollY;
      }
      var to = a.dataset.go === "work" ? LIST_AT * V : 0;
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
