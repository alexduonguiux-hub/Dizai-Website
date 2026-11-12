/* Project page (Figma Work-Detail-00 … 03; built by tools/build-details.py).
   - Opening: the title, the facts and the small picture come in (letters
     rising, assets/js/roll.js).
   - 00 → 01, over one screen of scroll: the first picture grows from its
     small slot between LAUNCH and CLIENT into its place in the column
     (696 × 434), and the facts roll away, letter by letter (scrolling back
     plays it back). Then the column runs up over the title, which sinks
     back (fades) as the pictures pass.
   - The pictures hang like sheets of paper pinned at the top, as on Work
     and About: they flutter and swing with the speed of the scroll.
   - Thumbnails bottom right: the current picture lit; a click goes there.
   - At the top, one more scroll up goes back to Work (on this project);
     past the end, on to the next project. Leaving, what shows rolls away. */
(function () {
  "use strict";
  var root = document.documentElement;
  var Roll = window.DzRoll, gsap = window.gsap;
  function done() { root.classList.remove("is-entering"); }
  if (!Roll || !gsap) return done();

  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var q = function (s) { return [].slice.call(document.querySelectorAll(s)); };
  var one = function (s) { return document.querySelector(s); };
  var clamp = function (x) { return x < 0 ? 0 : x > 1 ? 1 : x; };
  var lerp = function (a, b, k) { return a + (b - a) * k; };
  var ease = gsap.parseEase("power2.inOut");

  var sc = one(".dt-scroll"), title = one(".dt-title"), ph = one(".dt-ph");
  var info = q(".dt-info").filter(function (el) { return el.getClientRects().length; });
  var facts = q(".dt-launch, .dt-client, .dt-services, .dt-desc");
  var shots = q(".dt-shot"), first = shots[0];
  var thumbs = q(".dt-thumbs button");
  var UP = new URL(document.body.dataset.up || "../../#work", location.href).href;
  var DOWN = new URL(document.body.dataset.down || "../../#work", location.href).href;

  // going back to Work opens on this project
  try { sessionStorage.setItem("dz-v", JSON.stringify({ p: 1, l: +document.body.dataset.project || 0 })); } catch (e) {}
  if (sc.focus) { sc.setAttribute("tabindex", "-1"); try { sc.focus({ preventScroll: true }); } catch (e) {} }

  /* ---------- the pictures: sheets of paper ---------- */
  var FLAT = matchMedia("(max-width: 720px), (pointer: coarse)").matches;
  var STRIPS = 18;
  var sheets = shots.map(function (fig, i) {
    var img = fig.querySelector("img"), sh = { fig: fig, img: img, bands: [], ph: i * 1.7, swing: 0, vswing: 0 };
    if (FLAT) { fig.classList.add("is-flat"); return sh; }
    var src = img.getAttribute("src"), parent = document.createElement("span");
    parent.className = "sheet"; parent.style.setProperty("--n", STRIPS); parent.setAttribute("aria-hidden", "true");
    var sheet = parent;
    for (var k = 0; k < STRIPS; k++) {
      var band = document.createElement("span");
      band.className = "sheet-band";
      band.style.backgroundImage = "url(\"" + src + "\")";
      band.style.backgroundPosition = "0px calc(var(--bh) * " + (-k) + ")";
      parent.appendChild(band); sh.bands.push(band); parent = band;
    }
    fig.appendChild(sheet); fig.classList.add("has-sheet");
    sh.sheet = sheet;
    return sh;
  });
  function sizeSheets() {
    sheets.forEach(function (sh) {
      if (!sh.sheet) return;
      var w = sh.fig.offsetWidth, h = sh.fig.offsetHeight;
      sh.sheet.style.setProperty("--bh", (h / STRIPS).toFixed(3) + "px");
      sh.sheet.style.setProperty("--bgw", w.toFixed(2) + "px");
      sh.sheet.style.setProperty("--bgh", h.toFixed(2) + "px");
    });
  }

  /* ---------- scroll: grow the first picture, roll the facts away ---------- */
  var outs = facts.map(function (el) { return Roll.text(el, "out"); });
  var entered = false;
  function s0() { return sc.clientHeight; } // one screen of scroll
  function place() {
    var t = sc.scrollTop, S = s0(), p = clamp(t / S);
    // the first picture: from the small slot (fixed) to its own place,
    // which it reaches at t = S (the column's top, 283 down)
    var r0 = ph.getBoundingClientRect();
    var box = sc.getBoundingClientRect(); // the frame may start lower (phones: under the menu row)
    var W = first.offsetWidth, natLeft = box.left + first.offsetLeft, natTop = box.top + first.offsetTop - t, endTop = box.top + first.offsetTop - S;
    if (p < 1 && W) {
      var e = reduce ? 1 : ease(p);
      var w = lerp(r0.width, W, e), left = lerp(r0.left, natLeft, e), top = lerp(r0.top, endTop, e);
      first.style.transform = "translate(" + (left - natLeft).toFixed(2) + "px," + (top - natTop).toFixed(2) + "px) scale(" + (w / W).toFixed(5) + ")";
    } else first.style.transform = "";
    // the facts roll away one after another as it grows
    if (entered) outs.forEach(function (r, i) { r.set(clamp(p * 1.7 - i * 0.15)); });
    // the title sinks back as the pictures run up over it
    title.style.opacity = (1 - 0.82 * clamp((t - S * 0.9) / (S * 0.6))).toFixed(3);
    // the picture nearest the top place is the current one
    var best = 1e9, cur = 0;
    shots.forEach(function (s, i) {
      var d = Math.abs((s.offsetTop - t) - (first.offsetTop - S));
      if (d < best) { best = d; cur = i; }
    });
    thumbs.forEach(function (b, i) { b.classList.toggle("is-on", i === cur); });
  }
  var raf = 0;
  sc.addEventListener("scroll", function () { if (!raf) raf = requestAnimationFrame(function () { raf = 0; place(); }); }, { passive: true });
  window.addEventListener("resize", function () { sizeSheets(); place(); });

  thumbs.forEach(function (b, i) {
    b.addEventListener("click", function () {
      var y = s0() + shots[i].offsetTop - first.offsetTop;
      sc.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
    });
  });

  /* ---------- the flutter ---------- */
  var wind = 0, lastY = sc.scrollTop;
  gsap.ticker.add(function (time, deltaTime) {
    var dt = Math.min(3, deltaTime / 16.67), y = sc.scrollTop, vy = y - lastY; lastY = y;
    wind += (Math.max(-90, Math.min(90, vy)) - wind) * 0.3; wind *= 0.94;
    var gust = Math.max(-1, Math.min(1, wind / 40)), vh = innerHeight, per = 12 / STRIPS;
    sheets.forEach(function (sh) {
      sh.vswing += (gust * 10 - sh.swing) * 0.08 * dt; sh.vswing *= Math.pow(0.86, dt); sh.swing += sh.vswing * dt;
      var r = sh.fig.getBoundingClientRect();
      if (r.bottom < -50 || r.top > vh + 50) return; // only the ones in view
      if (FLAT) {
        var tilt = (reduce ? 0 : Math.sin(time * 1.3 + sh.ph) * 0.6) + sh.swing * 0.12;
        sh.img.style.transform = "rotate(" + tilt.toFixed(3) + "deg)";
        return;
      }
      for (var k = 0; k < STRIPS; k++) {
        var f = k / (STRIPS - 1);
        var wave = reduce ? 0 : (Math.sin(time * 2.1 + sh.ph - k * 0.55 * per) * (0.6 + 2.2 * f)
                               + Math.sin(time * 3.4 + sh.ph * 1.7 - k * 0.9 * per) * 0.5 * f) * per;
        var ang = (k === 0 ? sh.swing * 0.6 : 0) + wave + sh.swing * 0.55 * f * per;
        var side = reduce ? 0 : (Math.sin(time * 1.5 + sh.ph - k * 0.45 * per) * 0.5 * (0.3 + f) + sh.swing * 0.03) * per;
        sh.bands[k].style.transform = "rotateX(" + (-ang).toFixed(2) + "deg) rotateZ(" + side.toFixed(2) + "deg)";
      }
    });
  });

  /* ---------- coming in ---------- */
  function play(r, delay, then) {
    var o = { v: 0 };
    gsap.to(o, { v: 1, duration: reduce ? 0.01 : 0.85, delay: reduce ? 0 : delay, ease: "none",
                 onUpdate: function () { r.set(o.v); }, onComplete: then });
  }
  function enter() {
    sizeSheets();
    place();
    var ins = [title].concat(info, facts).map(function (el) { var r = Roll.text(el, "in"); r.set(0); return r; });
    var pic = Roll.box(first, "in"); pic.set(0);
    done();
    var n = ins.length;
    ins.forEach(function (r, i) {
      play(r, 0.05 + i * 0.07, i === n - 1 ? function () { entered = true; place(); } : null);
    });
    play(pic, 0.25);
  }
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(enter);

  /* ---------- leaving ---------- */
  var gone = false;
  function leave(href) {
    if (gone) return;
    gone = true;
    Roll.leave(href, [title].concat(info, facts.filter(function (el) { return !el.classList.contains("is-rolling"); })), shots);
  }
  window.addEventListener("pageshow", function (e) { if (e.persisted) gone = false; });
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    var url = new URL(a.href, location.href);
    if (url.origin !== location.origin || a.target) return;
    if (url.pathname === location.pathname && !url.hash) return;
    e.preventDefault();
    leave(url.href);
  });

  /* ---------- past the ends: Work above, the next project below ---------- */
  function atTop() { return sc.scrollTop <= 1; }
  function atEnd() { return sc.clientHeight + sc.scrollTop >= sc.scrollHeight - 2; }
  var lastWheel = 0, acc = 0, startEdge = 0;
  window.addEventListener("wheel", function (e) {
    if (gone || e.ctrlKey) return;
    var now = performance.now(), fresh = now - lastWheel > 220;
    lastWheel = now;
    var dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
    if (fresh) { acc = 0; startEdge = dy > 0 && atEnd() ? 1 : dy < 0 && atTop() ? -1 : 0; }
    var dir = dy > 0 ? 1 : dy < 0 ? -1 : 0;
    if (!dir || !(dir > 0 ? atEnd() : atTop())) { acc = 0; return; }
    acc += Math.abs(dy);
    if (acc > (startEdge === dir ? 40 : 240)) leave(dir > 0 ? DOWN : UP);
  }, { passive: true });
  var touch = null;
  window.addEventListener("touchstart", function (e) {
    if (e.touches.length !== 1) { touch = null; return; }
    touch = { y: e.touches[0].clientY, end: atEnd(), top: atTop() };
  }, { passive: true });
  function swiped(y) {
    if (!touch || gone) return;
    var dy = y - touch.y;
    if (touch.end && dy < -50) { touch = null; leave(DOWN); }
    else if (touch.top && dy > 60) { touch = null; leave(UP); }
  }
  window.addEventListener("touchmove", function (e) { swiped(e.touches[0].clientY); }, { passive: true });
  window.addEventListener("touchend", function (e) {
    var t = e.changedTouches && e.changedTouches[0];
    if (t) swiped(t.clientY);
    touch = null;
  }, { passive: true });
  window.addEventListener("keydown", function (e) {
    if (gone || e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key;
    if ((k === "ArrowDown" || k === "PageDown" || k === "End" || (k === " " && !e.shiftKey)) && atEnd()) { e.preventDefault(); leave(DOWN); }
    else if ((k === "ArrowUp" || k === "PageUp" || k === "Home" || (k === " " && e.shiftKey)) && atTop()) { e.preventDefault(); leave(UP); }
  });
})();
