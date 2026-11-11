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
     1.0  – 1.6 V  (mobile: WORK rises), SCROLL DOWN rolls away, the first project
                   arrives (desktop: from below; mobile: from the right) and
                   its name rolls in — Work-02
     1.6 V →       the projects keep travelling as an endless list; the
                   scroll wraps round so it never runs out, and the name
                   beside them slide along, a step at a time, with the current project

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
  /* The mark inverts where a picture passes under it, like the cursor: a
     white copy in "difference" (paper → near black, a picture → its
     negative) plus a copy in rgb(18 64 23) "plus-lighter", so on the paper
     the sum is exactly the ink green #215028 again. Browsers without
     plus-lighter keep the plain green mark. */
  var marks = [mark];
  if (window.CSS && CSS.supports("mix-blend-mode", "plus-lighter")) {
    var src = mark.getAttribute("src"); // keeps the ?v= cache stamp
    var tint = mark.cloneNode(false);
    tint.src = src.replace("dizai-mark.svg", "dizai-mark-tint.svg");
    mark.src = src.replace("dizai-mark.svg", "dizai-mark-white.svg");
    mark.classList.add("work-mark--invert");
    tint.classList.add("work-mark--tint");
    mark.parentNode.insertBefore(tint, mark.nextSibling);
    marks.push(tint);
  }
  var title = q(".work-title");
  var hint = q(".work-hint");
  var caption = q(".work-caption");
  var capList = caption.querySelector(".wc-list");
  var navHome = q('.nav-list a[data-go="home"]');
  var navWork = q('.nav-list a[data-go="work"]');
  var cards = [].slice.call(work.querySelectorAll(".work-card"));
  var N = cards.length;

  /* Layout per screen size, in units of the content width (G.W).
     Desktop: Figma Work-01 10:1481 / Work-02 23:10013 (1432 grid) — a
     column of 573 × 430 pictures 40 apart at x 736, WORK at the bottom
     left. Mobile: Work-01 22:3 / Work-02 22:66 (358 grid) — a row of
     350 × 262 pictures 8 apart under WORK, the names under them. */
  // WORK: desktop 262 at the bottom left (183 tall, 6 above the content's
  // foot) in both frames; mobile 99 (69 tall), in the middle (402 on an
  // 812-tall screen), then up to 140
  var DESK = { W: 1432, axis: "y", pitch: 470, len: 430, pitchV: 0.38,
               titleY: function () { return H - 183 - 6; }, titleY2: function () { return H - 183 - 6; },
               contactY: -251, hint: true };
  // how far Home's block sits below the top on a tall screen (see the CSS)
  function heroDrop() { var h = q(".hero"); return h ? parseFloat(getComputedStyle(h).marginTop) || 0 : 0; }
  var MOB = { W: 358, axis: "x", pitch: 358, len: 350, pitchV: 0.35,
              titleY: function () { return (H - 69) * 402 / 743; }, titleY2: function () { return 140; },
              contactY: 0, hint: true };
  var G = DESK, unit = 1, H = 733, cardTop = 226, cs = 1; // cs: picture scale (mobile)
  var list = work.querySelector(".work-list");

  function measure() {
    var r = work.getBoundingClientRect(); // transforms are GSAP's
    unit = r.width / G.W;
    H = r.height / unit;
    if (G.axis === "x") {
      // Figma Work-02: WORK 140–209, pictures from 226, the names (~151) 40
      // under them. Short screens for their width (a small tablet held
      // upright): lift the pictures, then make them smaller.
      var room = H - 16 - 151 - 40;              // where the pictures must end
      cardTop = Math.max(209 + 12, Math.min(226, room - 262));
      cs = Math.max(0.55, Math.min(1, (room - cardTop) / 262));
      list.style.setProperty("--cs", cs.toFixed(4));
      work.style.setProperty("--cap-top", ((cardTop + 262 * cs + 40) * unit).toFixed(1) + "px");
    } else { cs = 1; list.style.removeProperty("--cs"); work.style.removeProperty("--cap-top"); }
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
  var contactOut = Roll.text(contact, "out"); // mobile Work has no contact block
  var titleIn = Roll.text(title, "in");
  var markIns = marks.map(function (m) { return Roll.box(m, "in"); });
  var hintIn = hint ? Roll.text(hint, "in") : null, hintOut = hint ? Roll.text(hint, "out") : null;

  function showTitle(v) { title.classList.toggle("is-on", v > 0); titleIn.set(v); }
  function showMark(v) {
    marks.forEach(function (m, i) { m.classList.toggle("is-on", v > 0); markIns[i].set(v); });
  }
  // SCROLL DOWN rolls in (h 0 → 1), then away (1 → 2)
  function showHint(h) {
    if (!hint) return;
    hint.classList.toggle("is-on", h > 0 && h < 2);
    if (h <= 1) { hintOut.set(0); hintIn.set(h); } else { hintIn.set(1); hintOut.set(h - 1); }
  }

  /* The project names beside the pictures (Figma 29:24523 / 29:24528).
     Every project's name is listed, pale; the current one is in ink with
     its line under it. Desktop: three names above it and three below,
     going round; mobile: it comes first, the next four under it. When the
     current project changes the names slide one step, so the new one
     moves into its place. */
  var SLOT_H = 30;              // a name (14 cap) + the 16 gap, in px
  var slots = [], capShown = -1, capOn = false;
  // no single word alone on the last line: the last two words are tied
  // with a no-break space (text-wrap: pretty in the CSS evens the rest)
  function noWidow(t) {
    var m = /^(.*\S)\s+(\S+)\s*$/.exec(t || "");
    return m && m[1].indexOf(" ") > -1 ? m[1] + "\u00a0" + m[2] : (t || "");
  }
  function offsets() { return G.axis === "y" ? [-3, -2, -1, 0, 1, 2, 3] : [0, 1, 2, 3, 4]; }
  function buildSlots() {
    capList.textContent = ""; slots = [];
    offsets().forEach(function (o) {
      var li = document.createElement("li"), n = document.createElement("span"), d = document.createElement("span"),
          c = document.createElement("span");
      li.className = "wc-item"; n.className = "wc-name"; d.className = "wc-desc"; c.className = "wc-cat";
      li.appendChild(n); li.appendChild(d); li.appendChild(c); capList.appendChild(li);
      slots.push({ o: o, li: li, name: n, desc: d, cat: c });
    });
    capShown = -1;
  }
  function fill(k) {
    slots.forEach(function (sl) {
      var c = cards[((k + sl.o) % N + N) % N];
      sl.name.textContent = noWidow(c.dataset.name);
      sl.desc.textContent = sl.o === 0 ? noWidow(c.dataset.desc) : "";
      sl.cat.textContent = sl.o === 0 ? (c.dataset.cat || "") : "";
      sl.li.classList.toggle("is-active", sl.o === 0);
    });
  }
  caption.style.visibility = "hidden";
  function showCaption(k) {
    if (!slots.length) buildSlots();
    if (k < 0) { // before Work-02: not there at all
      if (capOn) {
        capOn = false;
        gsap.to(caption, { autoAlpha: 0, duration: 0.25, overwrite: true });
      }
      return;
    }
    if (!capOn) {
      capOn = true;
      fill(k); capShown = k;
      gsap.fromTo(caption, { autoAlpha: 0 }, { autoAlpha: 1, duration: reduce ? 0.01 : 0.4, overwrite: true });
    }
    if (k !== capShown) {
      // the shorter way round: one step down the list or up
      var d = ((k - capShown) % N + N) % N; if (d > N / 2) d -= N;
      capShown = k;
      fill(k);
      if (!reduce) gsap.fromTo(capList, { y: d * SLOT_H }, { y: 0, duration: 0.4, ease: "power2.out", overwrite: true });
    }
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
    var PIT = G.pitch * cs, LEN = G.len * cs; // mobile pictures may be scaled down
    var span = PIT * N;
    // list offset (units): 0 at Work-02, growing as you scroll on; before
    // that the first picture travels in from just off screen
    var start = G.axis === "y" ? H : G.W;
    var o = v >= LIST_AT ? (v - LIST_AT) * RATE : -start * Math.min(1, (LIST_AT - v) / (LIST_AT - ENTER_AT)) - (v < ENTER_AT ? 1e5 : 0);
    var active = -1, best = 1e9;
    cards.forEach(function (c, k) {
      var p = k * PIT - o;
      if (o >= 0) p = ((p + PIT) % span + span) % span - PIT;
      // past the content edge, into the gutter (the next one peeks in)
      var max = G.axis === "y" ? H : G.W + 16 / unit;
      var show = p > -LEN && p < max;
      c.style.opacity = show ? "1" : "0";
      c.classList.toggle("is-on", show);
      if (show) {
        if (G.axis === "y") gsap.set(c, { x: 0, y: p * unit });
        else gsap.set(c, { x: p * unit, y: cardTop * unit });
      }
      // the current project is the picture level with its name: desktop,
      // the one spanning the current name's line (y 324: the list's foot is
      // the first picture's, Figma 309 + half a line);
      // mobile, the one over the middle of the screen, above the name
      var at = G.axis === "y" ? 324 : G.W / 2;
      var gap = at < p ? p - at : at > p + LEN ? at - p - LEN : 0;
      if (gap < best) { best = gap; active = k; }
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

  var lastCards = -1, navTween = null, active = -1;
  function tick(time, deltaTime) {
    if (!on || root.classList.contains("is-loading")) return;
    var dt = Math.min(3, deltaTime / 16.67);
    if (!navTween) wrap();
    // same smoothing feel as the timeline's scrub
    smooth.y += (window.scrollY - smooth.y) * (reduce || navTween ? 1 : Math.min(1, 0.12 * dt));
    var v = smooth.y / V;
    if (Math.abs(smooth.y - lastCards) > 0.3) { active = placeCards(v); lastCards = smooth.y; }
    // the names follow the picture level with them, sliding a step at a time
    showCaption(v >= CAPTION_AT ? active : -1);
    swayStep(dt, time * 1000);
  }

  /* ---------- the menu's glide: the user can take over ----------
     The user takes over from a menu glide by touching,
     wheeling or pressing a key. GSAP's own autoKill is off: iOS reports the
     scroll a little off from what was set, which it read as the user
     scrolling, so the glide stopped halfway. */
  function takeOver() { if (navTween) { navTween.kill(); navTween = null; } }
  window.addEventListener("wheel", takeOver, { passive: true });
  window.addEventListener("keydown", function (e) {
    if (/^(Arrow|Page|Home|End| )/.test(e.key)) takeOver();
  });
  window.addEventListener("touchstart", function (e) {
    // a tap on the menu starts its own glide; any other touch takes over
    if (!(e.target.closest && e.target.closest(".nav-list a[data-go]"))) takeOver();
  }, { passive: true });

  /* ---------- GSAP: the scroll timeline ---------- */

  var DARK = "#215028", LIGHT = "#749674", keepV = 0, curTl = null, curSettle = null;
  var mm = gsap.matchMedia();
  ScrollTrigger.config({ ignoreMobileResize: true }); // phone URL bar: no re-layout

  mm.add({ desk: "(min-width: 721px)", mob: "(max-width: 720px)" }, function (ctx) {
    G = ctx.conditions.desk ? DESK : MOB;
    slots = []; // the names list is rebuilt for this layout
    V = window.innerHeight;
    on = true;
    root.classList.add("has-scrub");
    measure();
    RATE = G.pitch * cs / G.pitchV; LOOP = N * G.pitchV; HI = LO + LOOP;
    loops = 0; lastCards = -1;
    smooth.y = window.scrollY;

    // the timeline's time is measured in V (viewport heights of scroll)
    var tl = curTl = gsap.timeline({
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
    /* fn(v) runs from → to over [at, at + dur] of the timeline. The value
       is worked out from the timeline's own time (not a tween's recorded
       start), so a resize, which re-measures the timeline, can never leave
       Home's letters shown on top of Work. */
    var drives = [];
    function drive(fn, from, to, at, dur) {
      var o = { v: from };
      fn(from);
      drives.push({ fn: fn, from: from, to: to, at: at, dur: dur });
      tl.fromTo(o, { v: from }, { v: to, duration: dur, immediateRender: false,
                                  onUpdate: function () { fn(o.v); } }, at);
    }
    curSettle = settle;
    function settle() {
      var t = tl.time();
      // one value per piece: a piece driven twice (SCROLL DOWN rolls in,
      // later rolls away) takes the last part that has begun, else the first
      var pick = [];
      drives.forEach(function (d) {
        var i = -1;
        for (var j = 0; j < pick.length; j++) if (pick[j].fn === d.fn) i = j;
        if (i < 0) pick.push(d);
        else if (t >= d.at) pick[i] = d;
      });
      pick.forEach(function (d) {
        var q = Math.max(0, Math.min(1, (t - d.at) / d.dur));
        d.fn(d.from + (d.to - d.from) * q);
      });
    }

    // the letters only Home has roll away, one line after another
    outs.forEach(function (r, i) { drive(r.set, 0, 1, i < 4 ? i * 0.06 : 0.04 + (i - 4) * 0.04, i < 4 ? 0.4 : 0.3); });
    drive(sealOut.set, 0, 1, 0.12, 0.35);
    // desktop: the contact block slides up to its Work place (251 units);
    // mobile: it rolls away with the rest of Home
    if (G.contactY) tl.fromTo(contact, { y: 0 }, { y: function () { return G.contactY * unit - heroDrop(); }, duration: 0.6, ease: "dz.move" }, 0.1);
    else drive(contactOut.set, 0, 1, 0.08, 0.3);
    // Work-01: WORK rolls in at the bottom, the mark slides in
    gsap.set(title, { y: function () { return G.titleY() * unit; }, color: DARK });
    drive(showTitle, 0, 1, 0.45, 0.45);
    drive(showMark, 0, 1, 0.55, 0.3);
    if (G.hint) drive(showHint, 0, 1, 0.6, 0.3); else showHint(0);
    // Work-02: WORK stays ink (mobile: rises under the mark), SCROLL DOWN leaves
    tl.fromTo(title, { y: function () { return G.titleY() * unit; }, color: DARK },
                     { y: function () { return G.titleY2() * unit; }, color: DARK, duration: 0.6, ease: "dz.move" }, 1.0);
    if (G.hint) drive(showHint, 1, 2, 1.0, 0.25);
    tl.set({}, {}, LIST_AT); // timeline length = LIST_AT V

    var onRefresh = function () { V = window.innerHeight; measure(); RATE = G.pitch * cs / G.pitchV; lastCards = -1; };
    ScrollTrigger.addEventListener("refreshInit", onRefresh);
    // after every re-measure (resize), put each piece back where the scroll is
    var onRefreshed = function () {
      // coming from the other layout: ScrollTrigger has just put back the
      // scroll it saved while the page was short; go back to our point
      if (keepV > 0) {
        var y = Math.min(keepV, HI - 0.01) * V;
        keepV = 0;
        window.scrollTo(0, y); smooth.y = lastY = y; lastCards = -1;
        tl.scrollTrigger && tl.scrollTrigger.update();
      }
      settle();                         // right away: not one frame of Home
      requestAnimationFrame(settle);    // and once more after the scrub catches up
    };
    ScrollTrigger.addEventListener("refresh", onRefreshed);
    gsap.ticker.add(tick);

    return function () { // leaving this layout: undo everything
      // remember where we were (in V) so the next layout opens at the same
      // point of the story instead of back at Home
      keepV = window.scrollY / V;
      gsap.ticker.remove(tick);
      ScrollTrigger.removeEventListener("refreshInit", onRefresh);
      ScrollTrigger.removeEventListener("refresh", onRefreshed);
      on = false;
      root.classList.remove("has-scrub");
      outs.forEach(function (r) { r.set(0); });
      contactOut.set(0);
      sealOut.set(0); titleIn.revert(); markIns.forEach(function (r) { r.set(1); }); showHint(0);
      [contact, title, mark].concat(cards).forEach(function (el) {
        el.style.transform = el.style.opacity = el.style.color = "";
      });
      title.classList.remove("is-on"); marks.forEach(function (m) { m.classList.remove("is-on"); });
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
        scrollTo: { y: to, autoKill: false },       // see takeOver() below
        duration: reduce ? 0 : Math.max(1.2, Math.min(2.6, 0.9 + dist * 0.45)),
        ease: "dz.nav",
        onComplete: function () { navTween = null; },
        onInterrupt: function () { navTween = null; }
      });
    });
  });

  /* ---------- other pages (Contact) ---------- */

  // going there: what shows rolls away first
  document.querySelectorAll(".nav-list a:not([data-go])").forEach(function (a) {
    a.addEventListener("click", function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      e.preventDefault();
      Roll.leave(a.href, [q(".nav-list"), contact, title, hint, capList].concat(homeText),
                 [seal].concat(marks, cards));
    });
  });

  window.scrollTo(0, 0);
  // remembered for a reload (see below)
  window.addEventListener("pagehide", function () {
    try { sessionStorage.setItem("dz-v", (window.scrollY / V).toFixed(3)); } catch (e) {}
  });

  // coming back: no loading screen (once per visit); Home rolls in, or,
  // for "#work", the page glides on to Work
  if (root.classList.contains("is-return")) {
    root.classList.add("is-back"); // the letters below start blank
    // where to open: "#work" from another page → Work-02; a reload →
    // wherever you were (not Home with Work's scroll under it)
    var openV = 0, nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
    if (location.hash === "#work") openV = LIST_AT;
    else if (nav && nav.type === "reload") { try { openV = +sessionStorage.getItem("dz-v") || 0; } catch (e) {} }
    if (openV > 0.05) {
      // the scroll and the timeline are put there before anything shows,
      // then Work's own pieces come in
      if (location.hash) history.replaceState(null, "", location.pathname);
      var y = Math.min(openV, HI - 0.01) * V;
      window.scrollTo(0, y); smooth.y = lastY = y; lastCards = -1;
      ScrollTrigger.update();
      if (curTl) {
        var st = curTl.scrollTrigger, scrub = st && st.getTween && st.getTween();
        if (scrub) scrub.progress(1);
        curTl.progress(Math.min(1, openV / LIST_AT));
        if (curSettle) curSettle(); // every piece at its state for this point, now
      }
      var inWork = [q(".nav-list")].concat(openV >= 0.9 ? [title] : [], G.contactY ? [contact] : [])
        .map(function (el) { var r = Roll.text(el, "in"); r.set(0); return r; })
        .concat(openV >= 0.9 ? marks.map(function (m) { var r = Roll.box(m, "in"); r.set(0); return r; }) : []);
      gsap.fromTo(q(".work-list"), { autoAlpha: 0, y: 24 },
                  { autoAlpha: 1, y: 0, duration: reduce ? 0.01 : 0.9, delay: reduce ? 0 : 0.15, ease: "power2.out",
                    clearProps: "transform" });
      (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () {
        inWork.forEach(function (r, i) {
          var o = { v: 0 };
          gsap.to(o, { v: 1, duration: reduce ? 0.01 : 0.8, delay: reduce ? 0 : 0.05 + i * 0.08, ease: "none",
                       onUpdate: function () { r.set(o.v); } });
        });
      });
    } else {
      var back = [q(".nav-list"), contact].concat(homeText)
        .filter(function (el) { return el && el.getClientRects().length; })
        .map(function (el) { var r = Roll.text(el, "in"); r.set(0); return r; });
      var sealBack = seal ? Roll.box(seal, "in") : null;
      if (sealBack) { back.push(sealBack); sealBack.set(0); }
      (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () {
        back.forEach(function (r, i) {
          var o = { v: 0 };
          gsap.to(o, { v: 1, duration: reduce ? 0.01 : 0.8, delay: reduce ? 0 : 0.05 + i * 0.07, ease: "none",
                       onUpdate: function () { r.set(o.v); } });
        });
      });
    }
  }
})();
