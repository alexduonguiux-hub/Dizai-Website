/* Letters rising — the site's one transition: going, every letter slides
   up and blurs away; coming, every letter rises from below out of a blur
   into focus. The letters go one after another along the line.

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

  var RISE = 0.45;  // em: how far a letter travels
  var BLUR = 0.07;  // em of blur when furthest out (+ 2 px so small type blurs too)
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
          if (gapSpace && it.top - lastTop > 2) gapSpace.br = true;
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
      split = { cells: cells };
      el.classList.add("is-rolling");
      if (live.indexOf(api) < 0) live.push(api);
    }

    function doRevert() {
      if (!split) return;
      // every letter span holds its own letter: put the plain text back
      [].forEach.call(el.querySelectorAll("br.rbr"), function (b) {
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
      var cs = split.cells, n = cs.length, spread = n > 1 ? Math.min(0.6, 0.04 * n) : 0;
      for (var i = 0; i < n; i++) {
        var start = n > 1 ? spread * i / (n - 1) : 0;
        var q = clamp01((v - start) / (1 - spread));
        // away: up and into a blur (slow start); in: up from below, out of
        // the blur (soft landing). a = how far from resting, 0 … 1
        var a = dir === "out" ? q * q : (1 - q) * (1 - q);
        var st = cs[i].style;
        st.transform = a ? "translateY(" + ((dir === "out" ? -RISE : RISE) * a).toFixed(3) + "em)" : "";
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
    try { var f = sessionStorage.getItem("dz-flip") === "1"; sessionStorage.removeItem("dz-flip"); return f; }
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

  function leave(href, pieces, boxes) {
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
    var rs = pieces.filter(function (el) { return shown(el) && !el.classList.contains("is-rolling"); })
                   .map(function (el) { return text(el, "out"); })
      .concat((boxes || []).filter(shown).map(function (el) { return box(el, "out"); }));
    var o = { v: 0 }, gone = false;
    function go() { if (!gone) { gone = true; location.href = href; } }
    gsap.to(o, { v: 1, duration: 0.5, ease: "none", onComplete: go,
                 onUpdate: function () { rs.forEach(function (r, i) { r.set(o.v * 1.25 - i * 0.03); }); } });
    setTimeout(go, 1200); // never get stuck here
  }

  window.DzRoll = { text: text, box: box, leave: leave, flip: flip, takeFlip: takeFlip };
})();
