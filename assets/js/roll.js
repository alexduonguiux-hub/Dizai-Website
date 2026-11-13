/* Letters rising — the site's one transition: going, every letter slides
   up and blurs away; coming, every letter rises from below out of a blur
   into focus. The whole text moves as one (RUN = true: the letters go
   one after another along the line instead).

   DzRoll.text(el, "out" | "in")  → { set(v), revert() }
     v 0 → 1. "out": the text rolls away (v 0 = as it is, 1 = gone).
     "in": the text rolls in (v 0 = blank, 1 = as it is).
     The element is split into letters only while it moves; at rest the
     original DOM is put back (links, kerning, selection all untouched).
     Each letter keeps the exact advance it had in the original text, so
     kerning holds while rolling too.
   DzRoll.box(el, "out" | "in")   → { set(v) }
     The same move for an image (seal, mark): it rises and blurs.
   No dependencies; the motion is driven by whoever calls set() (GSAP). */
(function () {
  "use strict";

  var RISE = 0.45;  // em: how far a letter travels…
  var RISE_MAX = 18; // …but never more than this many px: big type only
                     // shifts a little while it blurs into focus
  var BLUR = 0.07;  // em of blur when furthest out (+ 2 px so small type blurs too)
  var RUN = false;  // true: letter after letter along the line; false: all together, surfacing from below
  var live = [];

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

  var ctx2d = null;
  function measureCh(font, ch) {
    try {
      ctx2d = ctx2d || document.createElement("canvas").getContext("2d");
      ctx2d.font = font;
      return ctx2d.measureText(ch).width;
    } catch (e) { return 0; }
  }

  function textNodes(el) {
    var out = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    while (w.nextNode()) if (/\S/.test(w.currentNode.nodeValue)) out.push(w.currentNode);
    return out;
  }

  // opts.blur false: the letters only rise (and fade), no blur
  function text(el, dir, opts) {
    if (dir === "in" && isArrival(el)) return glideIn();
    if (!RUN) return whole(el, dir, opts);
    var split = null, last = -1;

    // the menu's letters only rise, without the blur
    var noBlur = !!(opts && opts.blur === false) || !!(el.closest && el.closest(".site-nav"));

    function doSplit() {
      var nodes = textNodes(el), range = document.createRange(), cells = [], n = 0;
      // 1. where every letter sits in the untouched text (kerning included)
      var plan = nodes.map(function (tn) {
        var s = tn.nodeValue, items = [];
        for (var i = 0; i < s.length; i++) {
          if (/\s/.test(s[i])) { items.push({ ch: s[i] }); continue; }
          range.setStart(tn, i); range.setEnd(tn, i + 1);
          var r = range.getClientRects()[0] || range.getBoundingClientRect();
          items.push({ ch: s[i], left: r.left, top: r.top, w: r.width, idx: n++ });
        }
        return items;
      });
      // advance = distance to the next letter on the same line
      // (within one text node: the next text node may be another link on
      // the same row, like the next menu item)
      plan.forEach(function (items) {
        var flat = items.filter(function (it) { return it.w != null; });
        flat.forEach(function (it, j) {
          var nx = flat[j + 1];
          it.adv = nx && Math.abs(nx.top - it.top) < 2 && nx.left > it.left ? nx.left - it.left : null;
        });
      });
      // the last letter of a line has nothing after it to measure against,
      // and its box can run on to the end of the line (a menu column on a
      // phone gave "E" 4.5em): measure its own advance instead
      plan.forEach(function (items, ni) {
        var cs = getComputedStyle(nodes[ni].parentNode);
        var font = cs.fontStyle + " " + cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
        var tt = cs.textTransform;
        items.forEach(function (it) {
          if (it.w == null || it.adv != null) return;
          var ch = tt === "uppercase" ? it.ch.toUpperCase() : tt === "lowercase" ? it.ch.toLowerCase() : it.ch;
          var m = measureCh(font, ch);
          it.adv = m > 0 ? Math.min(it.w, m) : it.w;
          it.w = it.adv;
        });
      });
      // where a line wraps (at a space): kept as a line break while the
      // letters move, as the line can't wrap between letter boxes
      // (.is-rolling is nowrap: a menu column once broke "WOR / K")
      var lastTop = null, gapSpace = null;
      plan.forEach(function (items) {
        lastTop = null; gapSpace = null; // within one text: a <br> between texts is there already
        items.forEach(function (it) {
          if (it.w == null) { if (lastTop != null && !gapSpace) gapSpace = it; return; }
          if (lastTop != null && it.top - lastTop > 2) {
            if (gapSpace) gapSpace.br = true; else it.brBefore = true; // wrapped with no space ("produce—pure")
          }
          gapSpace = null; lastTop = it.top;
        });
      });
      // 2. swap the text for letter windows
      nodes.forEach(function (tn, ni) {
        var fs = parseFloat(getComputedStyle(tn.parentNode).fontSize) || 16; // widths in this text's em
        var frag = document.createDocumentFragment(), buf = "";
        function flush() { if (buf) { frag.appendChild(document.createTextNode(buf)); buf = ""; } }
        plan[ni].forEach(function (it, k) {
          if (it.br) { flush(); var br = document.createElement("br"); br.className = "rbr"; frag.appendChild(br); return; }
          if (it.w == null) { buf += it.ch; return; }
          if (it.brBefore) { flush(); var bb = document.createElement("br"); bb.className = "rbr rbr0"; frag.appendChild(bb); }
          // a space after this letter keeps its own width as text
          var nextSpace = plan[ni][k + 1] && plan[ni][k + 1].w == null;
          flush();
          var c = document.createElement("span");
          c.className = "rc";
          var wpx = nextSpace ? it.w : it.adv;
          c.style.width = (wpx / fs).toFixed(4) + "em";
          c.textContent = it.ch;
          c.dataset.blur = noBlur ? "0" : (fs * BLUR + 2).toFixed(1);
          frag.appendChild(c);
          cells.push(c);
        });
        flush();
        tn.parentNode.replaceChild(frag, tn);
      });
      var efs = parseFloat(getComputedStyle(el).fontSize) || 16;
      split = { cells: cells, rise: Math.min(RISE, RISE_MAX / efs) };
      el.classList.add("is-rolling");
      if (live.indexOf(api) < 0) live.push(api);
    }

    function doRevert() {
      if (!split) return;
      // every letter span holds its own letter: put the plain text back
      [].forEach.call(el.querySelectorAll("br.rbr"), function (b) {
        if (b.classList.contains("rbr0")) return b.parentNode.removeChild(b);
        b.parentNode.replaceChild(document.createTextNode(" "), b);
      });
      var cells = el.querySelectorAll(".rc");
      [].forEach.call(cells, function (c) {
        c.parentNode.replaceChild(document.createTextNode(c.textContent), c);
      });
      el.normalize();
      el.classList.remove("is-rolling");
      split = null;
      var i = live.indexOf(api); if (i >= 0) live.splice(i, 1);
    }

    function apply(v) {
      var cs = split.cells, n = cs.length, spread = RUN && n > 1 ? Math.min(0.6, 0.04 * n) : 0;
      for (var i = 0; i < n; i++) {
        var start = n > 1 ? spread * i / (n - 1) : 0;
        var q = clamp01((v - start) / (1 - spread));
        // away: up and into a blur (slow start); in: up from below, out of
        // the blur (soft landing). a = how far from resting, 0 … 1
        var a = dir === "out" ? q * q : (1 - q) * (1 - q);
        var st = cs[i].style;
        st.transform = a ? "translateY(" + ((dir === "out" ? -split.rise : split.rise) * a).toFixed(3) + "em)" : "";
        var bl = +cs[i].dataset.blur;
        st.filter = a && bl ? "blur(" + (a * bl).toFixed(2) + "px)" : "";
        st.opacity = (1 - a).toFixed(3);
      }
    }

    var api = {
      set: function (v) {
        v = clamp01(v);
        if (v === last && split) return;
        last = v;
        // at rest the real text is back
        var rest = dir === "out" ? v <= 0 : v >= 1;
        if (rest) { doRevert(); el.style.visibility = ""; return; }
        if (!split) doSplit();
        apply(v);
      },
      revert: doRevert,
      resplit: function () { if (split) { var v = last; doRevert(); last = -1; api.set(v); } }
    };
    return api;
  }

  /* All the letters together (RUN = false): the element moves as one,
     so one layer is blurred instead of one per letter (far lighter while
     scrolling). Uses translate and filter (blur + opacity), leaving the
     element's own transform and opacity to the page. While it moves it
     carries .is-fading (at rest: untouched). */
  function whole(el, dir, opts) {
    var noBlur = !!(opts && opts.blur === false) || !!(el.closest && el.closest(".site-nav"));
    var last = -1, fs = 0;
    function clear() { el.style.translate = el.style.filter = el.style.willChange = ""; el.classList.remove("is-fading"); }
    var api = {
      set: function (v) {
        v = clamp01(v);
        if (v === last) return;
        last = v;
        var a = dir === "out" ? v * v : (1 - v) * (1 - v);
        if (!a) { clear(); return; }
        if (!el.classList.contains("is-fading")) {
          fs = parseFloat(getComputedStyle(el).fontSize) || 16;
          el.classList.add("is-fading");
          el.style.willChange = "translate, filter";
        }
        var rise = Math.min(RISE * fs, RISE_MAX), bl = noBlur ? 0 : fs * BLUR + 2;
        el.style.translate = "0 " + ((dir === "out" ? -rise : rise) * a).toFixed(2) + "px";
        el.style.filter = (bl ? "blur(" + (a * bl).toFixed(2) + "px) " : "") + "opacity(" + (1 - a).toFixed(3) + ")";
      },
      revert: clear,
      resplit: function () {}
    };
    return api;
  }

  // images: slide up through a window the size of the box
  function box(el, dir, opts) {
    var noBlur = !!(opts && opts.blur === false);
    var last = -1;
    return {
      set: function (v) {
        v = clamp01(v);
        if (v === last) return;
        last = v;
        // a = how far from resting, 0 … 1 (same curves as the letters)
        var a = dir === "out" ? v * v : (1 - v) * (1 - v);
        el.style.visibility = a >= 1 ? "hidden" : "";
        if (!a) { el.style.translate = el.style.filter = el.style.opacity = el.style.clipPath = ""; return; }
        var h = el.getBoundingClientRect().height || 100;
        el.style.translate = "0 " + ((dir === "out" ? -1 : 1) * a * Math.min(0.3 * h, 60)).toFixed(1) + "px";
        el.style.filter = noBlur ? "" : "blur(" + (a * Math.min(0.05 * h + 2, 14)).toFixed(2) + "px)";
        el.style.opacity = (1 - a).toFixed(3);
      }
    };
  }

  // the font arriving changes every advance: measure again
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { live.slice().forEach(function (r) { r.resplit(); }); });
  }

  /* Leaving for another page: every piece that shows rolls away (text) or
     slides up out of its window (pictures), quickly, then the browser goes
     on. pieces: elements; boxes: elements drawn as pictures. Needs GSAP. */
  function shown(el) {
    if (!el || !el.getClientRects().length) return false;
    var cs = getComputedStyle(el), r = el.getBoundingClientRect();
    return cs.visibility !== "hidden" && +cs.opacity > 0.05 &&
           r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  }
  /* The small "đs" mark sits in the same place on About, Work and
     Contact. Going from one of them to another it stays where it is (it
     does not roll away and back): the next page turns it over once
     (flip()). A note in sessionStorage carries that across the page load. */
  var MARK = ".ab-mark, .cp-mark, .work-mark";
  function hasMark(href) {
    var u = new URL(href, location.href);
    return /\/(about|contact)\/?$/.test(u.pathname) || u.hash === "#work"; // (project pages carry their title there instead)
  }
  function flipNext() { try { sessionStorage.setItem("dz-flip", "1"); } catch (e) {} }
  function takeFlip() {
    // (if this page then reloads itself for a newer version, the note is put back: window.dzFlipTaken)
    try { var f = sessionStorage.getItem("dz-flip") === "1"; sessionStorage.removeItem("dz-flip"); if (f) window.dzFlipTaken = true; return f; }
    catch (e) { return false; }
  }
  // one full turn about the upright axis, like a coin given a flick: it
  // picks up speed, spins, slows down against friction and settles with
  // a last small rock
  function flip(els) {
    var gsap = window.gsap;
    els = (els || []).filter(Boolean);
    if (!gsap || !els.length || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.CustomEase && !gsap.parseEase("dz.flip")) {
      window.CustomEase.create("dz.flip", "M0,0 C0.3,0 0.38,0.62 0.56,0.92 0.66,1.06 0.8,1.012 0.88,0.997 0.94,0.99 0.97,1 1,1");
    }
    var ease = gsap.parseEase("dz.flip") || "power3.inOut";
    gsap.fromTo(els, { rotationY: 0, transformPerspective: 700 },
                     { rotationY: 360, duration: 1.5, ease: ease, overwrite: "auto",
                       onComplete: function () { gsap.set(els, { clearProps: "transform" }); } });
  }

  // pages of the site are opened with this page's version stamp (?v=), so
  // the browser does not show an old copy from its cache
  function stamped(href) {
    var u = new URL(href, location.href), css = document.querySelector('link[rel="stylesheet"][href*="?v="]');
    var v = css && new URL(css.href).searchParams.get("v");
    if (u.origin !== location.origin || !v || u.searchParams.has("v") || /\.[a-z0-9]+$/i.test(u.pathname)) return u.href;
    u.searchParams.set("v", v);
    return u.href;
  }
  /* The small contact block (email, phone, city) is the same on every
     page. Going to another page of the site it does not roll away and
     back: its place is noted, and on the next page it glides from there
     to its own place (on the same spot it just stays). A phone shows it
     only on Home / Work. */
  var CONTACT = "address.contact";
  function keepsContact(href) {
    var u = new URL(href, location.href);
    if (u.origin !== location.origin) return false;
    var home = !/\/(about|contact|work\/[^/]+)\/?$/.test(u.pathname);
    return home || !matchMedia("(max-width: 720px)").matches;
  }
  var arrival, leadUntil = 0;
  var GLIDE = 0.75; // s: the block's move; the new page's own pieces come in after it
  function loadArrival() {
    if (arrival === undefined) {
      arrival = null;
      try {
        var a = JSON.parse(sessionStorage.getItem("dz-contact") || "null");
        sessionStorage.removeItem("dz-contact");
        if (a && Date.now() - a.t < 8000) arrival = a;
      } catch (e) {}
    }
    return arrival;
  }
  function isArrival(el) {
    return !!(el.matches && el.matches(CONTACT) && loadArrival());
  }
  // seconds still to wait before a page's own pieces come in: while the
  // contact block glides over from the last page, nothing else moves
  function wait() {
    var a = loadArrival();
    if (!a || matchMedia("(prefers-reduced-motion: reduce)").matches) return 0;
    if (!leadUntil) {
      var el = [].slice.call(document.querySelectorAll(CONTACT)).filter(function (e) { return e.getClientRects().length; })[0];
      var r = el && el.getBoundingClientRect();
      if (!r || (Math.abs(a.x - r.left) < 1 && Math.abs(a.y - r.top) < 1)) { leadUntil = -1; return 0; }
      leadUntil = performance.now() + (GLIDE - 0.1) * 1000;
    }
    return leadUntil < 0 ? 0 : Math.max(0, (leadUntil - performance.now()) / 1000);
  }
  var glided = false; // one glide for the block and its twins
  function glideIn() {
    function start() {
      if (glided) return;
      glided = true;
      // every copy of the block (the inverting twins too) moves together
      var els = [].slice.call(document.querySelectorAll(CONTACT)).filter(function (e) { return e.getClientRects().length; });
      if (!els.length) return;
      var r = els[0].getBoundingClientRect();
      var dx = arrival.x - r.left, dy = arrival.y - r.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      wait(); // starts the clock the rest of the page waits on
      var gsap = window.gsap, o = { k: 1 };
      function put() { els.forEach(function (e) { e.style.translate = o.k ? (dx * o.k).toFixed(1) + "px " + (dy * o.k).toFixed(1) + "px" : ""; }); }
      put();
      if (!gsap || matchMedia("(prefers-reduced-motion: reduce)").matches) { o.k = 0; put(); return; }
      gsap.to(o, { k: 0, duration: GLIDE, ease: "power3.inOut", onUpdate: put });
    }
    return { set: start, revert: function () {}, resplit: function () {} };
  }

  function leave(href, pieces, boxes) {
    href = stamped(href);
    // the contact block goes along to the next page: it stays put here
    if (keepsContact(href)) {
      var info = (pieces || []).filter(function (el) { return el && el.matches && el.matches(CONTACT) && shown(el); });
      if (info.length) {
        var ir = info[0].getBoundingClientRect();
        try { sessionStorage.setItem("dz-contact", JSON.stringify({ x: ir.left, y: ir.top, t: Date.now() })); } catch (e) {}
        pieces = pieces.filter(function (el) { return !(el && el.matches && el.matches(CONTACT)); });
      }
    }
    var gsap = window.gsap, reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    // to a page with the mark in the same place: the mark stays
    if (hasMark(href)) {
      var kept = (boxes || []).filter(function (el) { return el && el.matches && el.matches(MARK) && shown(el); });
      if (kept.length) {
        flipNext();
        boxes = boxes.filter(function (el) { return kept.indexOf(el) < 0; });
      }
    }
    if (!gsap || reduce) { location.href = href; return; }
    var rs = pieces.filter(function (el) { return shown(el) && !el.classList.contains("is-rolling") && !el.classList.contains("is-fading"); })
                   .map(function (el) { return text(el, "out"); })
      .concat((boxes || []).filter(shown).map(function (el) { return box(el, "out"); }));
    var o = { v: 0 }, gone = false;
    function go() { if (!gone) { gone = true; location.href = href; } }
    gsap.to(o, { v: 1, duration: 0.5, ease: "none", onComplete: go,
                 onUpdate: function () { rs.forEach(function (r, i) { r.set(o.v * 1.25 - i * 0.03); }); } });
    setTimeout(go, 1200); // never get stuck here
  }

  /* A hard scroll that brought us here (the end of the last page) goes on
     for a second or more on a trackpad (its inertia): on the new page that
     tail is let through to nothing, so one push never goes two pages.
     Wheel events arriving soon after the page opens, and every one after
     them with no pause, are dropped; once the wheel has been still for a
     moment (or the first one comes late) scrolling works as usual. */
  (function () {
    // (passive: the browser never waits on it, so scrolling stays smooth;
    // it only keeps the page's own handlers from taking the tail as a new
    // push, and it is removed once that tail is over)
    var t0 = performance.now(), last = 0, opts = { capture: true, passive: true };
    function done() { window.removeEventListener("wheel", hold, opts); }
    function hold(e) {
      var now = performance.now();
      if (now - t0 < 700 || now - last < 400) {
        last = now;
        e.stopImmediatePropagation();
        return;
      }
      done();
    }
    window.addEventListener("wheel", hold, opts);
    // nothing coming in after the first moments: gone without a wheel event
    (function check() {
      setTimeout(function () { if (performance.now() - last >= 400) done(); else check(); }, 800);
    })();
  })();

  /* Back / Forward: the browser may show the page again just as it was
     left (its back-forward cache), i.e. with everything rolled away and
     the page marked as gone. Then it is loaded afresh instead, so it
     comes in as usual. */
  window.addEventListener("pageshow", function (e) {
    if (!e.persisted) return;
    document.documentElement.style.visibility = "hidden";
    location.reload();
  });

  /* A finger on the screen, or the page still gliding on after it (its
     momentum): the paper sheets hold still meanwhile (their flutter,
     redrawn every frame, made a phone's scrolling stutter) */
  var touching = false, touchedAt = -1e9, scrolledAt = -1e9;
  window.addEventListener("touchstart", function () { touching = true; touchedAt = performance.now(); }, { passive: true, capture: true });
  function lift() { touching = false; touchedAt = performance.now(); }
  window.addEventListener("touchend", lift, { passive: true, capture: true });
  window.addEventListener("touchcancel", lift, { passive: true, capture: true });
  document.addEventListener("scroll", function () { scrolledAt = performance.now(); }, { passive: true, capture: true });
  function swiping() {
    if (touching) return true;
    var now = performance.now();
    // gliding on after the finger lifted: scroll events still coming
    return now - touchedAt < 4000 && now - scrolledAt < 160;
  }

  /* ---------- scrolling on to the next page, without surprises ----------
     DzRoll.gate({ scroller, prev, next, ignore })
       scroller  the element the page scrolls in (none: a page that does
                 not scroll, like Home / Work)
       prev/next what scrolling past the top / the end does (or null)
       ignore    function (event): true where the scroll is someone else's
                 (Work's list of projects)
     The rules, so a light touch or a long page's scroll never jumps away:
     1. Only from a page already resting at that end: it got there and
        stood still for a moment (REST), and the push is a new gesture
        (not the tail of the scroll that brought it there).
     2. Only a deliberate push past it: about three or four mouse-wheel
        notches in a row, a full trackpad swipe, over a quarter of the
        screen with a finger (let go to go on).
     3. The push shows (see show()): the next page's name comes in from
        the edge and grows to the middle, the content making way; html
        gets --pull 0 … 1. Let go short of it: all back as it was.
     Keys: Page Down / Space / ↓ at the end (resting), Page Up / ↑ at the top. */
  var REST = 450, QUIET = 250, PULL_WHEEL = 320, PULL_TOUCH = 0.28;
  function gate(o) {
    var sc = o.scroller || null, t0 = performance.now();
    var lastMove = -1e9, lastWheel = -1e9, g = null, pull = 0, endT = 0, done = false, tween = null;
    var root = document.documentElement;
    function atStart() { return !sc || sc.scrollTop <= 1; }
    function atEnd() { return !sc || sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2; }
    if (sc) sc.addEventListener("scroll", function () { lastMove = performance.now(); }, { passive: true });
    // (canPrev / canNext: whether that way is open right now, e.g. Home / Work)
    function can(dir) {
      return dir > 0 ? !!o.next && (!o.canNext || o.canNext()) && atEnd()
                     : !!o.prev && (!o.canPrev || o.canPrev()) && atStart();
    }
    function resting(now) { return now - lastMove > REST && now - t0 > 800; }
    /* The push shows where it goes: {NAME} (nextLabel / prevLabel, text
       or a function) comes in from the edge it is pulled from — the foot
       for the next page, the head for the one before — and travels to the
       middle of the screen growing to the size of the big titles, while
       the page's content (o.push(): its elements) is pushed away the other
       way to make room. Full: the page changes. Let go short of it: the
       name slides back out and the content back into place. */
    var cue = null, pushed = [];
    function label(dir) {
      var l = dir > 0 ? o.nextLabel : o.prevLabel;
      return typeof l === "function" ? l() : l;
    }
    function bigSize() { // the big titles' size: 172 of 1512 (phones: 70 of 358 + 32)
      return innerWidth <= 720 ? 70 * (innerWidth - 32) / 358 : 172 * innerWidth / 1512;
    }
    function ease(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }
    function show(p, dir) {
      pull = p;
      var e = ease(p), l = p > 0 ? label(dir) : "";
      root.style.setProperty("--pull", p.toFixed(3));
      root.classList.toggle("is-pulling-next", p > 0 && dir > 0);
      root.classList.toggle("is-pulling-prev", p > 0 && dir < 0);
      // the content, pushed away (up for the next page, down for the one before)
      var els = p > 0 && o.push ? o.push() : pushed;
      // (as far as the name travels and more, fading out into a blur — the
      // site's own way of letting text go — so the name has the room)
      var away = -dir * e * innerHeight * 0.62, blurPx = (innerWidth <= 720 ? 6 : 10) * e;
      (els || []).forEach(function (el) {
        if (!el) return;
        el.style.translate = p > 0 ? "0 " + away.toFixed(1) + "px" : "";
        el.style.opacity = p > 0 ? (1 - 0.92 * e).toFixed(3) : "";
        el.style.filter = p > 0 && blurPx > 0.1 ? "blur(" + blurPx.toFixed(2) + "px)" : "";
      });
      pushed = p > 0 ? els || [] : [];
      if (!l) { if (cue) cue.classList.remove("is-on"); return; }
      if (!cue) {
        cue = document.createElement("p");
        cue.className = "pull-cue";
        cue.setAttribute("aria-hidden", "true");
        document.body.appendChild(cue);
      }
      var txt = "{" + l + "}";
      if (cue.textContent !== txt) cue.textContent = txt;
      cue.classList.add("is-on");
      var small = parseFloat(getComputedStyle(root).getPropertyValue("--text-sm")) || 20;
      cue.style.fontSize = (small + (bigSize() - small) * e).toFixed(2) + "px";
      cue.style.fontWeight = Math.round(600 - 200 * e);
      var h = cue.offsetHeight, H = innerHeight;
      // from just inside its edge to the middle
      var from = dir > 0 ? H - h - H * 0.04 : H * 0.04, to = (H - h) / 2;
      cue.style.transform = "translateY(" + (from + (to - from) * e).toFixed(1) + "px)";
      cue.style.opacity = Math.min(1, p * 4).toFixed(3);
    }
    function release() {
      g = null;
      if (done || !pull) return;
      var from = { p: pull }, dir = root.classList.contains("is-pulling-prev") ? -1 : 1;
      if (tween) tween.kill();
      if (window.gsap) tween = window.gsap.to(from, { p: 0, duration: 0.35, ease: "power2.out", onUpdate: function () { show(from.p, dir); } });
      else show(0, dir);
    }
    function fire(dir) {
      if (done) return;
      done = true;
      show(1, dir);
      (dir > 0 ? o.next : o.prev)();
    }
    window.addEventListener("wheel", function (e) {
      if (done || e.ctrlKey) return;
      var now = performance.now(), fresh = now - lastWheel > QUIET;
      lastWheel = now;
      if (o.ignore && o.ignore(e)) { release(); return; }
      var dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
      var dir = dy > 0 ? 1 : dy < 0 ? -1 : 0;
      if (!dir) return;
      if (fresh) g = can(dir) && resting(now) ? { dir: dir, acc: 0 } : null;
      if (!g || dir !== g.dir) { release(); return; }
      if (tween) { tween.kill(); tween = null; }
      g.acc += Math.abs(dy);
      show(Math.min(1, g.acc / PULL_WHEEL), dir);
      if (g.acc >= PULL_WHEEL) fire(dir);
      clearTimeout(endT); endT = setTimeout(release, QUIET);
    }, { passive: true });
    var t = null;
    window.addEventListener("touchstart", function (e) {
      if (done || e.touches.length !== 1) { t = null; return; }
      var now = performance.now();
      t = { x: e.touches[0].clientX, y: e.touches[0].clientY, next: can(1) && resting(now), prev: can(-1) && resting(now), dir: 0, off: o.ignore && o.ignore(e) };
    }, { passive: true });
    window.addEventListener("touchmove", function (e) {
      if (!t || t.off || done) return;
      var dx = e.touches[0].clientX - t.x, dy = t.y - e.touches[0].clientY; // dy > 0: pulling up, on to the next
      if (!t.dir) {
        if (Math.abs(dy) < 10 || Math.abs(dx) > Math.abs(dy)) return;  // sideways: not ours
        t.dir = dy > 0 ? 1 : -1;
      }
      if (!(t.dir > 0 ? t.next : t.prev) || dy * t.dir <= 0) { show(0, t.dir); return; }
      if (tween) { tween.kill(); tween = null; }
      show(Math.min(1, dy * t.dir / (innerHeight * PULL_TOUCH)), t.dir);
    }, { passive: true });
    function lift() {
      if (!t) return;
      var dir = t.dir; t = null;
      if (pull >= 1 && dir) fire(dir); else release();
    }
    window.addEventListener("touchend", lift, { passive: true });
    window.addEventListener("touchcancel", lift, { passive: true });
    window.addEventListener("keydown", function (e) {
      if (done || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || "")) return;
      var k = e.key, now = performance.now();
      var down = k === "PageDown" || k === "ArrowDown" || (k === " " && !e.shiftKey);
      var up = k === "PageUp" || k === "ArrowUp" || (k === " " && e.shiftKey);
      if (o.ignore && o.ignore(e)) return;
      if (down && can(1) && resting(now)) { e.preventDefault(); fire(1); }
      else if (up && can(-1) && resting(now)) { e.preventDefault(); fire(-1); }
    });
    return { atStart: atStart, atEnd: atEnd };
  }

  window.DzRoll = { text: text, box: box, leave: leave, flip: flip, takeFlip: takeFlip, wait: wait, swiping: swiping, gate: gate };
})();
