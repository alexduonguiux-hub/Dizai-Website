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
   - Past the end, one more scroll goes on to the next project; at the top
     scrolling up stays on the page (Work is the menu's WORK, and opens on
     this project). Leaving, what shows rolls away. */
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

  /* the menu and the contact block stay on top of the pictures and invert
     where one passes under them, like the cursor and the marks: the real
     one white in "difference", a twin on top in rgb(13 12 11)
     "plus-lighter" (over the paper: the ink #1c1c1c; over ink: the paper;
     over a picture: its negative) */
  if (window.CSS && CSS.supports("mix-blend-mode", "plus-lighter")) {
    q(".page-detail .site-nav, .dt-info").forEach(function (el) {
      var tw = el.cloneNode(true);
      tw.setAttribute("aria-hidden", "true");
      [].forEach.call(tw.querySelectorAll("a"), function (a) { a.tabIndex = -1; });
      [].forEach.call(tw.querySelectorAll("nav"), function (n) { n.removeAttribute("aria-label"); });
      el.classList.add("is-invert");
      tw.classList.add("is-tint");
      el.parentNode.insertBefore(tw, el.nextSibling);
      var real = el.querySelectorAll("a"), copy = tw.querySelectorAll("a");
      [].forEach.call(real, function (a, i) {
        a.addEventListener("pointerenter", function () { if (copy[i]) copy[i].classList.add("is-hover"); });
        a.addEventListener("pointerleave", function () { if (copy[i]) copy[i].classList.remove("is-hover"); });
      });
    });
  }

  var sc = one(".dt-scroll"), title = one(".dt-title"), ph = one(".dt-ph");
  var info = q(".dt-info").filter(function (el) { return el.getClientRects().length; });
  var facts = q(".dt-services, .dt-desc, .dt-meta, .dt-visit");
  var factsBox = one(".dt-facts");
  /* the facts sit under the pictures, so a click on Visit project lands on
     the picture frame first; hand it on to the link when no picture is
     there (and the link has not rolled away) */
  sc.addEventListener("click", function (e) {
    if ((e.target.closest && e.target.closest(".dt-shot")) || factsBox.classList.contains("is-gone")) return;
    var v = one(".dt-visit");
    if (!v) return;
    var r = v.getBoundingClientRect();
    if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top - 8 && e.clientY <= r.bottom + 8) {
      window.open(v.href, "_blank", "noopener");
    }
  });
  var shots = q(".dt-shot"), first = shots[0];
  var thumbs = q(".dt-thumbs button");
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
  // phones: the facts start 20 under the title, however many lines it runs to
  function titleFoot() {
    var r = title.getBoundingClientRect();
    root.style.setProperty("--dt-title-bottom", (r.bottom - (parseFloat(getComputedStyle(title).marginBottom) || 0)).toFixed(1) + "px");
  }
  titleFoot();
  /* The zoom follows the scroll eased (sm catches up with scrollTop a
     little each frame): a mouse wheel jumps 100 px a notch, and the
     picture would jump with it. The page itself still scrolls as it does;
     the first picture is kept where the eased value puts it. */
  var sm = sc.scrollTop;
  function place() {
    if (!easing) sm = sc.scrollTop; // a finger: no lag at all
    var t = sc.scrollTop, S = s0(), p = clamp(sm / S);
    // the first picture: from the small slot (fixed) to its own place,
    // which it reaches at t = S (the column's top, 283 down)
    var r0 = ph.getBoundingClientRect();
    var box = sc.getBoundingClientRect(); // the frame may start lower (phones: under the menu row)
    // (offsets measured from the frame: the column of pictures is itself
    // positioned, for the line at its end)
    var col = first.offsetParent === sc ? null : first.offsetParent;
    var ox = first.offsetLeft + (col ? col.offsetLeft : 0), oy = first.offsetTop + (col ? col.offsetTop : 0);
    // the whole column runs on the eased value too (held back by sm − t)
    if (col) col.style.translate = Math.abs(t - sm) > 0.5 ? "0 " + (t - sm).toFixed(2) + "px" : "";
    var W = first.offsetWidth, natLeft = box.left + ox, natTop = box.top + oy - (col ? sm : t), endTop = box.top + oy - S;
    if (W && (p < 1 || Math.abs(sm - t) > 0.5)) {
      var e = reduce ? 1 : ease(p);
      var w = lerp(r0.width, W, e), left = lerp(r0.left, natLeft, e),
          top = p < 1 ? lerp(r0.top, endTop, e) : box.top + oy - sm; // past the zoom: on with the eased value
      first.style.transform = "translate(" + (left - natLeft).toFixed(2) + "px," + (top - natTop).toFixed(2) + "px) scale(" + (w / W).toFixed(5) + ")";
    } else first.style.transform = "";
    // the facts roll away one after another as it grows (they sit under
    // the pictures, so whatever is left is covered as the pictures run up)
    if (entered) outs.forEach(function (r, i) { r.set(clamp(p * 1.7 - i * 0.15)); });
    factsBox.classList.toggle("is-gone", p > 0.35); // the link takes no clicks once it has rolled away
    // the title sinks back as the pictures run up over it
    title.style.opacity = (1 - 0.82 * clamp((sm - S * 0.9) / (S * 0.6))).toFixed(3);
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
  // only a wheel (a mouse's notches, a trackpad) is eased: a finger on a
  // touch screen already scrolls smoothly, and any lag behind it would
  // fight the browser's own momentum (it jerks)
  var easing = false;
  sc.addEventListener("wheel", function () { easing = true; }, { passive: true });
  ["touchstart", "pointerdown"].forEach(function (t) {
    window.addEventListener(t, function (e) {
      if (t === "pointerdown" && e.pointerType === "mouse") return;
      easing = false;
    }, { passive: true });
  });
  gsap.ticker.add(function (time, deltaTime) {
    var t = sc.scrollTop;
    if (sm === t) return;
    // not eased, or far off (a jump, a thumbnail far away): straight there
    if (!easing || reduce || Math.abs(t - sm) > 2 * s0()) sm = t;
    else {
      sm += (t - sm) * (1 - Math.pow(1 - 0.16, Math.min(3, deltaTime / 16.67)));
      if (Math.abs(t - sm) < 0.5) sm = t;
    }
    place();
  });
  window.addEventListener("resize", function () { titleFoot(); sizeSheets(); place(); });

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
    // a finger swiping (or the page gliding on after it): the sheets hold
    // still, so the phone's scrolling has nothing else to redraw
    if (Roll.swiping && Roll.swiping()) { wind = 0; return; }
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
    gsap.to(o, { v: 1, duration: reduce ? 0.01 : 0.85, delay: reduce ? 0 : delay + (window.DzRoll && DzRoll.wait ? DzRoll.wait() : 0), ease: "none",
                 onUpdate: function () { r.set(o.v); }, onComplete: then });
  }
  function enter() {
    titleFoot();
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
    Roll.leave(href, [title].concat(info, facts.filter(function (el) { return !el.classList.contains("is-rolling") && !el.classList.contains("is-fading"); })), shots);
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

  /* ---------- past the end: the next project ----------
     (DzRoll.gate: only from the end the page already rests at, and only a
     deliberate push; scrolling up at the top stays here: back to Work is
     the menu's WORK) */
  Roll.gate({
    scroller: sc, next: function () { leave(DOWN); },
    nextLabel: document.body.dataset.nextName || "Next project",
    push: function () { return [sc]; },
    pieces: function () { return { texts: [].slice.call(document.querySelectorAll(".dt-end")), boxes: shots }; }
  });
})();
