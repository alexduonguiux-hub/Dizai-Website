/* Home → Work → Contact (Figma Home, Work-02 23:10013 / 22:66, Contact).
   Desktop and mobile share the story; only the layout differs (below).

   The page is one pinned stage with no scrollbar and two states:
     Home  the letters only Home has roll away, like the loading counter's
           digits; the seal slides up out of its window; desktop: the
           contact block slides up to its Work place
     Work  WORK rolls in, the small "đs" mark slides in, the first project
           arrives (desktop: from below; mobile: from the right) with its
           name and line beside / under it
   A light scroll (or swipe, or key) down on Home plays the move to Work;
   up plays it back. In Work, scrolling over the projects (desktop: the
   names and pictures column; mobile: swiping sideways over the row) runs
   the endless list, a project at a time; scrolling anywhere else goes on
   to Contact (down) or back to Home (up). The project pictures hang like
   sheets of paper pinned at the top: they sway on their own and swing as
   the list moves. */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var stage = document.querySelector(".stage");
  var work = document.querySelector(".work");
  if (!stage || !work) return;
  if (!window.gsap || !window.CustomEase || !window.DzRoll) return; // Work stays a plain section
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  var gsap = window.gsap, Roll = window.DzRoll;
  gsap.registerPlugin(window.CustomEase);

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
  // WORK: desktop 262 at the bottom left (183 tall, on the content's foot)
  // in both frames; mobile 99 (69 tall), in the middle (402 on an
  // 812-tall screen), then up to 140
  var DESK = { W: 1432, axis: "y", pitch: 470, len: 430, pitchV: 0.38,
               titleY: function () { return H - 183; }, titleY2: function () { return H - 183; },
               contactY: -251 };
  // how far Home's block sits below the top on a tall screen (see the CSS)
  function heroDrop() { var h = q(".hero"); return h ? parseFloat(getComputedStyle(h).marginTop) || 0 : 0; }
  var MOB = { W: 358, axis: "x", pitch: 358, len: 350, pitchV: 0.35,
              titleY: function () { return (H - 69) * 402 / 743; }, titleY2: function () { return 140; },
              contactY: 0 };
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
  /* Phones and touch screens: one flat sheet that sways on its pin. The
     18 nested 3D bands tear into white seams on high-density phone screens
     (and iOS Safari is unreliable with 3D nested that deep). */
  var FLAT = window.matchMedia("(max-width: 720px), (pointer: coarse)").matches;
  var sheets = cards.map(function (c, i) {
    var a = c.querySelector("a"), img = a.querySelector("img");
    if (FLAT) return { sheet: null, a: a, bands: [], ph: i * 1.9, swing: 0, vswing: 0 };
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
    if (FLAT) return;
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
  var wind = 0;

  // vy: how far the list moved this frame, in px (it blows the sheets about)
  function swayStep(dt, t, vy) {
    // gusts from scrolling, easing off
    wind += (Math.max(-90, Math.min(90, vy)) - wind) * 0.3;
    wind *= 0.94;
    var sec = t / 1000;
    sheets.forEach(function (sh) {
      // the whole sheet swings on its pin with a little lag (damped spring)
      var gust = Math.max(-1, Math.min(1, wind / 40));
      sh.vswing += (gust * 10 - sh.swing) * 0.08 * dt; sh.vswing *= Math.pow(0.86, dt); sh.swing += sh.vswing * dt;
      if (FLAT) { // one flat sheet: a slow sway on its pin, a swing with the scroll
        var tilt = (reduce ? 0 : Math.sin(sec * 1.3 + sh.ph) * 0.6) + sh.swing * 0.12;
        sh.a.style.transform = "rotate(" + tilt.toFixed(3) + "deg)";
        return;
      }
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

  /* The page has two states and no scrollbar: Home (0) and Work (1, Figma
     Work-02: the first project and its name). A light scroll / swipe / key
     goes from one to the other, played as one move (the timeline below,
     PHASE_T long). In Work the projects run as an endless list of their
     own: listT is the project in place, in steps of one picture (fractions
     on the way), listS the same smoothed. */
  var PHASE_T = 1.1;            // timeline length: Home → Work
  var ENTER_AT = 0.45;          // the first picture sets off
  var CAPTION_AT = 0.85;        // the names come in
  var MOVE = gsap.parseEase("dz.move");
  var phase = 0, listT = 0, listS = 0, lastListPx = 0, on = false;
  var lastKey = "", active = -1, busy = null, tl = null, curSettle = null;

  function pitchPx() { return G.pitch * cs * unit; }

  function placeCards(f, steps) {
    var PIT = G.pitch * cs, LEN = G.len * cs; // mobile pictures may be scaled down
    var span = PIT * N, o = steps * PIT;
    // before Work the whole list waits just off screen (below / to the
    // right) and travels in with the first picture leading
    var start = G.axis === "y" ? H : G.W;
    var shift = start * (1 - MOVE(f));
    var max = G.axis === "y" ? H : G.W + 16 / unit; // past the content edge, into the gutter
    var at = G.axis === "y" ? 324 : G.W / 2;
    var best = 1e9, act = -1;
    cards.forEach(function (c, k) {
      var pw = ((k * PIT - o + PIT) % span + span) % span - PIT; // where it rests in Work
      var p = pw + shift;
      // while travelling in, not the picture that rests above the first
      var show = f > 0 && p > -LEN && p < max && (f >= 1 || pw > -LEN * 0.5);
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
      var gap = at < pw ? pw - at : at > pw + LEN ? at - pw - LEN : 0;
      if (gap < best) { best = gap; act = k; }
    });
    return act;
  }

  function tick(time, deltaTime) {
    if (!on || root.classList.contains("is-loading")) return;
    var dt = Math.min(3, deltaTime / 16.67);
    if (!dragging) {
      listS += (listT - listS) * (reduce ? 1 : Math.min(1, 0.14 * dt));
      if (Math.abs(listT - listS) < 0.0005) listS = listT;
    }
    var t = tl ? tl.time() : 0;
    var f = Math.max(0, Math.min(1, (t - ENTER_AT) / (PHASE_T - ENTER_AT)));
    var key = f.toFixed(4) + "|" + listS.toFixed(4);
    if (key !== lastKey) { active = placeCards(f, listS); lastKey = key; }
    // the names follow the picture level with them, a step at a time
    showCaption(phase === 1 && t >= CAPTION_AT ? active : -1);
    var px = listS * pitchPx();
    swayStep(dt, time * 1000, Math.max(-90, Math.min(90, px - lastListPx)));
    lastListPx = px;
  }

  /* ---------- going between Home, Work and Contact ---------- */

  var DARK = "#215028", gone = false;
  function markNav(atWork) {
    if (atWork !== (navWork.getAttribute("aria-current") === "page")) {
      if (atWork) { navWork.setAttribute("aria-current", "page"); navHome.removeAttribute("aria-current"); }
      else { navHome.setAttribute("aria-current", "page"); navWork.removeAttribute("aria-current"); }
    }
  }
  function goTo(p) {
    if (!tl || gone) return;
    phase = p;
    markNav(p === 1);
    var to = p ? PHASE_T : 0;
    if (busy) busy.kill();
    var dist = Math.abs(to - tl.time()) / PHASE_T;
    if (reduce || dist < 0.001) { busy = null; tl.time(to); return; }
    busy = gsap.to(tl, { time: to, duration: 0.5 + 1.1 * dist, ease: "power1.inOut",
                         onComplete: function () { busy = null; } });
  }
  function goContact() {
    if (gone) return;
    gone = true;
    var a = document.querySelector(".nav-list a:not([data-go])");
    Roll.leave(a.href, [q(".nav-list"), contact, title, capList].concat(homeText),
               [seal].concat(marks, cards));
  }
  function down() { if (phase === 0) goTo(1); else goContact(); }
  function up() { if (phase === 1) goTo(0); }
  function step(d) { // one project on (+1) or back (−1)
    if (phase !== 1) return;
    listT = Math.round(listT) + d;
  }

  // where a pointer / finger is over the projects: desktop, the column of
  // names and pictures; mobile, the row of pictures and the names under it
  function inList(x, y) {
    var r = work.getBoundingClientRect();
    if (G.axis === "y") return x >= r.left + (368 - 24) * unit && x <= r.left + (736 + 573 + 24) * unit;
    var c = caption.getBoundingClientRect();
    return y >= r.top + (cardTop - 8) * unit && y <= Math.max(c.bottom, r.top + (cardTop + 262 * cs) * unit) + 16;
  }

  /* One gesture, one move: after going somewhere, the rest of that
     scroll (a trackpad's inertia goes on for a second or more) is let
     through to nothing, until the wheel has been still for a moment. */
  var locked = false, lockTimer = 0, acc = 0, lastWheel = 0, snapTimer = 0, lastStep = 0;
  function lock() {
    locked = true;
    clearTimeout(lockTimer);
    lockTimer = setTimeout(function () { locked = false; }, 260);
  }
  function snapSoon() {
    clearTimeout(snapTimer);
    snapTimer = setTimeout(function () { listT = Math.round(listT); }, 140);
  }
  function wheelPx(e, d) { return d * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1); }

  window.addEventListener("wheel", function (e) {
    if (!on || gone || root.classList.contains("is-loading")) return;
    if (e.ctrlKey) return; // pinch zoom on a trackpad
    e.preventDefault();
    var now = performance.now(), fresh = now - lastWheel > 200;
    lastWheel = now;
    if (locked) { lock(); return; }
    var dy = wheelPx(e, e.deltaY), dx = wheelPx(e, e.deltaX);
    if (phase === 1 && !busy && inList(e.clientX, e.clientY)) {
      // the projects: the wheel runs the list (sideways on a trackpad too)
      var d = Math.abs(dy) >= Math.abs(dx) ? dy : dx;
      acc = 0;
      if (Math.abs(d) >= 50) {
        // a mouse wheel's notch (or a hard push): one project per notch
        if (now - lastStep > 140) { lastStep = now; step(d > 0 ? 1 : -1); }
        return;
      }
      listT += d / pitchPx() * 1.4; // a trackpad: the list follows the fingers
      snapSoon();
      return;
    }
    if (busy) return;
    if (fresh) acc = 0;
    acc += dy;
    if (acc > 24) { acc = 0; lock(); down(); }
    else if (acc < -24) { acc = 0; if (phase === 1) { lock(); up(); } }
  }, { passive: false });

  /* Touch: up / down swipes go between Home, Work and Contact; in Work a
     swipe along the list (mobile: sideways, over the pictures and names;
     desktop layout on a touch screen: up and down over the column) drags
     the projects, and lets go onto the nearest one (a flick: the next). */
  var touch = null, dragging = false;
  window.addEventListener("touchstart", function (e) {
    if (!on || gone || e.touches.length !== 1) { touch = null; return; }
    var t = e.touches[0];
    touch = { x: t.clientX, y: t.clientY, axis: null, fired: false, at: performance.now(),
              inList: phase === 1 && !busy && inList(t.clientX, t.clientY), from: listT };
  }, { passive: true });
  window.addEventListener("touchmove", function (e) {
    if (!touch) return;
    if (e.cancelable) e.preventDefault(); // no page scroll, rubber band or pull-to-refresh
    var t = e.touches[0], dx = t.clientX - touch.x, dy = t.clientY - touch.y;
    if (!touch.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      touch.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (touch.inList && touch.axis === G.axis) {
      dragging = true;
      var d = G.axis === "x" ? -dx : -dy;
      listT = listS = touch.from + d / pitchPx();
      touch.d = d;
      return;
    }
    if (touch.axis !== "y" || touch.fired) return;
    if (dy < -40) { touch.fired = true; down(); }
    else if (dy > 40 && phase === 1) { touch.fired = true; up(); }
  }, { passive: false });
  function touchEnd() {
    if (!touch) return;
    if (dragging) {
      dragging = false;
      var d = touch.d || 0, ms = Math.max(1, performance.now() - touch.at);
      var target = Math.round(listT);
      // a quick flick goes on to the next one even if it moved only a little
      if (ms < 300 && Math.abs(d) > 24 && target === Math.round(touch.from)) target += d > 0 ? 1 : -1;
      listT = target;
    }
    touch = null;
  }
  window.addEventListener("touchend", touchEnd, { passive: true });
  window.addEventListener("touchcancel", touchEnd, { passive: true });

  window.addEventListener("keydown", function (e) {
    if (!on || gone || e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key;
    if (k === "ArrowDown" || k === "PageDown" || (k === " " && !e.shiftKey)) { e.preventDefault(); if (!busy) down(); }
    else if (k === "ArrowUp" || k === "PageUp" || (k === " " && e.shiftKey)) { e.preventDefault(); up(); }
    else if (k === "Home") { e.preventDefault(); goTo(0); }
    else if (k === "ArrowRight") { e.preventDefault(); step(1); }
    else if (k === "ArrowLeft") { e.preventDefault(); step(-1); }
  });

  /* ---------- GSAP: the Home → Work timeline ---------- */

  var mm = gsap.matchMedia();
  mm.add({ desk: "(min-width: 721px)", mob: "(max-width: 720px)" }, function (ctx) {
    G = ctx.conditions.desk ? DESK : MOB;
    slots = []; // the names list is rebuilt for this layout
    on = true;
    root.classList.add("has-scrub");
    window.scrollTo(0, 0);
    measure();
    lastKey = "";

    // the timeline's time runs 0 (Home) → PHASE_T (Work); goTo() plays it
    tl = gsap.timeline({ paused: true, defaults: { ease: "none" } });
    /* fn(v) runs from → to over [at, at + dur] of the timeline. The value
       is worked out from the timeline's own time, so after a resize every
       piece can be put back exactly (settle). */
    var drives = [];
    function drive(fn, from, to, at, dur) {
      var o = { v: from };
      fn(from);
      drives.push({ fn: fn, from: from, to: to, at: at, dur: dur });
      tl.fromTo(o, { v: from }, { v: to, duration: dur, immediateRender: false,
                                  onUpdate: function () { fn(o.v); } }, at);
    }
    function settle() {
      var t = tl.time();
      markNav(phase === 1);
      drives.forEach(function (d) {
        var k = Math.max(0, Math.min(1, (t - d.at) / d.dur));
        d.fn(d.from + (d.to - d.from) * k);
      });
      lastKey = "";
    }
    curSettle = settle;

    // the letters only Home has roll away, one line after another
    outs.forEach(function (r, i) { drive(r.set, 0, 1, i < 4 ? i * 0.05 : 0.04 + (i - 4) * 0.04, i < 4 ? 0.36 : 0.28); });
    drive(sealOut.set, 0, 1, 0.1, 0.32);
    // desktop: the contact block slides up to its Work place (251 units);
    // mobile: it rolls away with the rest of Home
    if (G.contactY) drive(function (v) { gsap.set(contact, { y: MOVE(v) * (G.contactY * unit - heroDrop()) }); }, 0, 1, 0.08, 0.55);
    else drive(contactOut.set, 0, 1, 0.06, 0.3);
    // Work: WORK rolls in where it stays (desktop on the foot, mobile under
    // the mark), the mark slides in
    drive(function (v) { gsap.set(title, { y: G.titleY2() * unit, color: DARK }); showTitle(v); }, 0, 1, 0.4, 0.45);
    drive(showMark, 0, 1, 0.5, 0.3);
    showHint(0);
    tl.set({}, {}, PHASE_T);

    tl.time(phase ? PHASE_T : 0);
    settle();

    var rT = 0;
    function onResize() {
      clearTimeout(rT);
      rT = setTimeout(function () { measure(); settle(); }, 60);
    }
    window.addEventListener("resize", onResize);
    gsap.ticker.add(tick);

    return function () { // leaving this layout: undo everything (phase and listT stay)
      if (busy) { busy.kill(); busy = null; }
      gsap.ticker.remove(tick);
      window.removeEventListener("resize", onResize);
      on = false;
      tl.kill(); tl = null;
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

  /* ---------- the menu ---------- */

  document.querySelectorAll(".nav-list a[data-go]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      if (!on) return; // no GSAP: the plain #anchors do the job
      e.preventDefault();
      goTo(a.dataset.go === "work" ? 1 : 0);
    });
  });
  // going to another page (Contact): what shows rolls away first
  document.querySelectorAll(".nav-list a:not([data-go])").forEach(function (a) {
    a.addEventListener("click", function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      e.preventDefault();
      goContact();
    });
  });

  // remembered for a reload and for coming back from Contact: Home or Work,
  // and which project
  window.addEventListener("pagehide", function () {
    try { sessionStorage.setItem("dz-v", JSON.stringify({ p: phase, l: Math.round(listT) % N })); } catch (e) {}
  });
  window.addEventListener("pageshow", function (e) { if (e.persisted) { gone = false; } });

  // coming back: no loading screen (once per visit); Home rolls in, or,
  // for "#work" (from Contact) or a reload in Work, Work's pieces do
  if (root.classList.contains("is-return")) {
    root.classList.add("is-back"); // the letters below start blank
    var saved = null, nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
    try { saved = JSON.parse(sessionStorage.getItem("dz-v") || "null"); } catch (e) {}
    var toWork = location.hash === "#work" || !!(nav && nav.type === "reload" && saved && saved.p === 1);
    if (saved && typeof saved.l === "number" && (toWork || (nav && nav.type === "reload"))) listT = listS = saved.l;
    if (location.hash) history.replaceState(null, "", location.pathname);
    if (toWork && tl) {
      // every piece is put at Work before anything shows, then Work's own
      // pieces come in
      phase = 1;
      tl.time(PHASE_T);
      if (curSettle) curSettle();
      var inWork = [q(".nav-list"), title].concat(G.contactY ? [contact] : [])
        .map(function (el) { var r = Roll.text(el, "in"); r.set(0); return r; })
        .concat(marks.map(function (m) { var r = Roll.box(m, "in"); r.set(0); return r; }));
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
          gsap.to(o, { v: 1, duration: reduce ? 0.01 : 0.8, delay: reduce ? 0 : 0.05 + i * 0.08, ease: "none",
                       onUpdate: function () { r.set(o.v); } });
        });
      });
    }
  }
})();
