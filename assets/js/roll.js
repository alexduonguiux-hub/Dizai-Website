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
    var last = -1, fs = 0, kept = null;
    function clear() {
      if (!kept) return; // never moved: leave it as the page has it
      el.style.translate = kept.translate; el.style.filter = kept.filter; el.style.willChange = kept.willChange; kept = null;
      el.classList.remove("is-fading");
    }
    var api = {
      set: function (v) {
        v = clamp01(v);
        if (v === last) return;
        last = v;
        var a = dir === "out" ? v * v : (1 - v) * (1 - v);
        if (!a) { clear(); return; }
        if (!el.classList.contains("is-fading")) {
          kept = { translate: el.style.translate, filter: el.style.filter, willChange: el.style.willChange };
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
  // WebKit (Safari, iPhone / iPad) at times leaves a blurred picture's
  // halo behind where it moved from (a smudge under the mark): there the
  // pictures move and fade without the blur
  var WEBKIT = document.documentElement.classList.contains("is-webkit");
  function box(el, dir, opts) {
    var noBlur = !!(opts && opts.blur === false) || WEBKIT;
    var last = -1, kept = null;
    // what the element had of its own (a page may set its opacity, like
    // Work's pictures): put back at rest, not wiped
    function keep() {
      if (!kept) kept = { visibility: el.style.visibility, translate: el.style.translate, filter: el.style.filter, opacity: el.style.opacity, clipPath: el.style.clipPath };
    }
    return {
      set: function (v) {
        v = clamp01(v);
        if (v === last) return;
        last = v;
        // a = how far from resting, 0 … 1 (same curves as the letters)
        var a = dir === "out" ? v * v : (1 - v) * (1 - v);
        if (!a) {
          // (never moved: nothing to put back, leave it as the page has it)
          if (kept) {
            for (var k in kept) el.style[k] = kept[k];
            kept = null;
          }
          return;
        }
        keep();
        el.style.visibility = a >= 1 ? "hidden" : kept.visibility;
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
     2. Only a deliberate push past it: two mouse-wheel notches in a row
        (one is not enough), a short trackpad swipe, a sixth of the screen
        with a finger (let go to go on).
     3. The push shows (see show()): the next page's name comes in from
        the edge and grows to the middle, the content making way; html
        gets --pull 0 … 1. Let go short of it: all back as it was.
     Keys: Page Down / Space / ↓ at the end (resting), Page Up / ↑ at the top. */
  var REST = 450, QUIET = 250, PULL_WHEEL = 200, PULL_TOUCH = 0.18;
  function gate(o) {
    var sc = o.scroller || null, t0 = performance.now();
    var lastMove = -1e9, lastWheel = -1e9, g = null, pull = 0, endT = 0, done = false;
    var root = document.documentElement;
    function atStart() { return !sc || sc.scrollTop <= 1; }
    function atEnd() { return !sc || sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2; }
    if (sc) sc.addEventListener("scroll", function () { lastMove = performance.now(); }, { passive: true });
    // (canPrev / canNext: whether that way is open right now, e.g. Home / Work)
    function can(dir) {
      return dir > 0 ? !!o.next && (!o.canNext || o.canNext()) && atEnd()
                     : !!o.prev && (!o.canPrev || o.canPrev()) && atStart();
    }
    // (a scroll carried over from the last page — its trackpad momentum,
    // still going as this page opens — never goes on to another page: only
    // a push begun once the page has been open a moment counts; scrolling
    // the page itself is free at once)
    function resting(now) { return now - lastMove > REST && now - t0 > 800; }
    /* The push shows where it goes: {NAME} (nextLabel / prevLabel, text
       or a function) comes in from the edge it is pulled from — the foot
       for the next page, the head for the one before — and travels to the
       middle of the screen growing to the size of the big titles, while
       the page's content (o.push(): its elements) is pushed away the other
       way to make room. Full: the page changes. Let go short of it: the
       name slides back out and the content back into place. */
    var cue = null, pushed = [], rolls = null;
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
      // (as far as the name travels and more, so the name has the room)
      var away = -dir * e * innerHeight * 0.62;
      (els || []).forEach(function (el) {
        if (el) el.style.translate = p > 0 ? "0 " + away.toFixed(1) + "px" : "";
      });
      // the pieces on screen go the way every text goes when a page changes
      // (rolling away into a blur, one after another), as far as the push
      // has come; back to as they were if it is let go (o.pieces():
      // { texts: [...], boxes: [...] })
      if (p > 0 && !rolls && o.pieces) {
        var pc = o.pieces() || {};
        // (not the ones still waiting to come in, or moving already)
        var free = function (el) { return el && shown(el) && !el.classList.contains("is-fading") && !el.classList.contains("is-rolling"); };
        rolls = (pc.texts || []).filter(free).map(function (el) { return text(el, "out"); })
          .concat((pc.boxes || []).filter(free).map(function (el) { return box(el, "out"); }));
      }
      if (rolls) {
        // (over the whole push: barely at first, gone just as the page
        // changes; each a touch after the one before)
        var n = rolls.length, lag = n > 1 ? Math.min(0.15, 0.012 * (n - 1)) : 0;
        rolls.forEach(function (r, i) {
          var off = n > 1 ? lag * i / (n - 1) : 0;
          r.set(Math.min(1, Math.max(0, (p - off) / (1 - lag))));
        });
        // all back: the page lays its pieces out afresh (what changed
        // meanwhile — Work's list moving on — is not undone by the put-back)
        if (!(p > 0)) { rolls = null; if (o.settle) o.settle(); }
      }
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
      // the size it grows to: the big titles', or the page's own (o.cueAs:
      // an element whose size, weight and width it takes — a project
      // title, for the next project)
      var like = o.cueAs && o.cueAs(), big = bigSize(), wt = 400, wide = 0;
      if (like) {
        var ls = getComputedStyle(like);
        big = parseFloat(ls.fontSize) || big;
        wt = parseFloat(ls.fontWeight) || wt;
        wide = like.getBoundingClientRect().width;
      }
      cue.style.fontSize = (small + (big - small) * e).toFixed(2) + "px";
      cue.style.fontWeight = Math.round(600 + (wt - 600) * e);
      // (a long name wraps as the title does, in the title's width)
      cue.style.whiteSpace = wide ? "normal" : "";
      cue.style.maxWidth = wide ? wide.toFixed(1) + "px" : "";
      cue.style.marginLeft = cue.style.marginRight = wide ? "auto" : "";
      cue.style.padding = wide ? "0" : "";
      var h = cue.offsetHeight, H = innerHeight;
      // from just inside its edge to the middle (at the head: below the menu
      // and the mark, never over them)
      var head = H * 0.04;
      [].forEach.call(document.querySelectorAll(".site-nav, .cp-mark, .ab-mark, .work-mark, .dt-title"), function (el) {
        var r = el.getBoundingClientRect();
        if (r.height && r.bottom < H / 2) head = Math.max(head, r.bottom + 16);
      });
      var from = dir > 0 ? H - h - H * 0.04 : head, to = Math.max(head, (H - h) / 2);
      cue.style.transform = "translateY(" + (from + (to - from) * e).toFixed(1) + "px)";
      // coming in like every text does: out of a blur into focus
      var fs = parseFloat(cue.style.fontSize) || small, a = 1 - e;
      cue.style.filter = a > 0.01 ? "blur(" + (a * (fs * BLUR + 2)).toFixed(2) + "px)" : "";
      // (not there at all for a slight push: no faint smudge)
      cue.style.opacity = Math.max(0, Math.min(1, (p - 0.08) * 3)).toFixed(3);
    }
    /* What is shown follows the push at a set pace, however hard the
       scroll: the name takes at least UP_S to come all the way in (and
       DOWN_S to go back out), and the page changes only once it is there
       (going: the push is locked at full, nothing can call it back). */
    var target = 0, tdir = 1, going = false, raf = 0, lastT = 0;
    var UP_S = 0.75, DOWN_S = 0.4;
    function loop(now) {
      raf = 0;
      var dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 1 / 60;
      lastT = now;
      var d = target - pull, max = (d > 0 ? dt / UP_S : dt / DOWN_S);
      // eased: quick to follow small changes, never faster than the pace
      var step = Math.max(-max, Math.min(max, d * 0.35 + (d > 0 ? 0.002 : -0.002)));
      var next = Math.abs(d) <= Math.abs(step) ? target : pull + step;
      if (next !== pull || (next === 0 && pull === 0)) show(Math.max(0, Math.min(1, next)), tdir);
      if (going && pull >= 0.999) {
        lastT = 0;
        // there: the name goes the way the page's texts go now (rising
        // away into a blur), as the page changes
        if (cue) {
          var out = text(cue, "out"), ov = { v: 0 };
          if (window.gsap) window.gsap.to(ov, { v: 1, duration: 0.45, ease: "none", onUpdate: function () { out.set(ov.v); } });
          else out.set(1);
        }
        (tdir > 0 ? o.next : o.prev)();
        return;
      }
      if (pull !== target || going) raf = requestAnimationFrame(loop); else lastT = 0;
    }
    function aim(t, dir) {
      if (done && !going) return;
      target = Math.max(0, Math.min(1, t));
      if (dir) tdir = dir;
      if (!raf) raf = requestAnimationFrame(loop);
    }
    function release() {
      g = null;
      if (going) return;
      aim(0);
    }
    function fire(dir) {
      if (done) return;
      done = true; going = true;
      aim(1, dir);
    }
    /* At a limit that does not go on (no page that way, or not yet: the
       page still gliding in), the content gives a little instead of
       stopping dead — heavier the further it goes (at most an eighth of
       the screen) — and springs back once let go. */
    // (only the first moment of a scroll stretches it — a trackpad's
    // momentum would otherwise hold it out for a second or more — then it
    // springs back at once, and that scroll's tail leaves it be)
    var band = 0, bandAcc = 0, bandT = 0, bandTween = null, bandFrom = 0, bandSpent = false, BAND_HOLD = 200;
    function atEdge(dir) { return dir > 0 ? atEnd() : atStart(); }
    function rubber(x) { var M = innerHeight * 0.12; return M * (1 - 1 / (x / M + 1)); }
    function setBand(v) {
      band = v;
      (o.push ? o.push() : sc ? [sc] : []).forEach(function (el) { if (el) el.style.translate = v ? "0 " + v.toFixed(1) + "px" : ""; });
    }
    function stretch(dir, amount) {
      if (bandTween) { bandTween.kill(); bandTween = null; }
      bandAcc = Math.max(0, amount);
      setBand(-dir * rubber(bandAcc));
    }
    function springBack() {
      bandAcc = 0;
      if (!band) return;
      var o2 = { v: band };
      if (window.gsap) bandTween = window.gsap.to(o2, { v: 0, duration: 0.42, ease: "back.out(2.2)", onUpdate: function () { setBand(o2.v); }, onComplete: function () { bandTween = null; setBand(0); } });
      else setBand(0);
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
      if (!g || dir !== g.dir) {
        release();
        // not going anywhere: the rubber band at the limit
        if (fresh) { bandSpent = false; bandFrom = now; }
        if (atEdge(dir) && !(pull > 0) && !bandSpent) {
          if (now - bandFrom > BAND_HOLD) { bandSpent = true; clearTimeout(bandT); springBack(); return; }
          stretch(dir, (band && Math.sign(-band) === dir ? bandAcc : 0) + Math.abs(dy) * 0.6);
          clearTimeout(bandT); bandT = setTimeout(springBack, 90);
        }
        return;
      }
      g.acc += Math.abs(dy);
      if (g.acc >= PULL_WHEEL) { fire(dir); return; }
      aim(g.acc / PULL_WHEEL, dir);
      clearTimeout(endT); endT = setTimeout(release, QUIET);
    }, { passive: true });
    var t = null;
    window.addEventListener("touchstart", function (e) {
      if (done || e.touches.length !== 1) { t = null; return; }
      var now = performance.now();
      t = { x: e.touches[0].clientX, y: e.touches[0].clientY, next: can(1) && resting(now), prev: can(-1) && resting(now), dir: 0, off: o.ignore && o.ignore(e), p: 0 };
    }, { passive: true });
    window.addEventListener("touchmove", function (e) {
      if (!t || t.off || done) return;
      var dx = e.touches[0].clientX - t.x, dy = t.y - e.touches[0].clientY; // dy > 0: pulling up, on to the next
      if (!t.dir) {
        if (Math.abs(dy) < 10 || Math.abs(dx) > Math.abs(dy)) return;  // sideways: not ours
        t.dir = dy > 0 ? 1 : -1;
      }
      if (!(t.dir > 0 ? t.next : t.prev) || dy * t.dir <= 0) {
        t.p = 0; aim(0, t.dir);
        // not going anywhere: the rubber band at the limit
        var bd = dy > 0 ? 1 : -1;
        if (dy * t.dir > 0 && atEdge(bd)) { if (t.edgeY == null) t.edgeY = dy; stretch(bd, Math.abs(dy - t.edgeY) * 0.8); t.band = true; }
        return;
      }
      t.p = Math.min(1, dy * t.dir / (innerHeight * PULL_TOUCH));
      aim(t.p, t.dir);
    }, { passive: true });
    function lift() {
      if (!t) return;
      if (t.band) springBack();
      var dir = t.dir, p = t.p; t = null;
      if (p >= 1 && dir) fire(dir); else release();
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
