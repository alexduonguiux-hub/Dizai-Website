/* Rolling letters — the site's one transition, after the loading counter:
   every letter is a little window; a column of letters rolls up through it
   (the real letter, two others, then blank — or the other way round).

   DzRoll.text(el, "out" | "in")  → { set(v), revert() }
     v 0 → 1. "out": the text rolls away (v 0 = as it is, 1 = gone).
     "in": the text rolls in (v 0 = blank, 1 = as it is).
     The element is split into letters only while it moves; at rest the
     original DOM is put back (links, kerning, selection all untouched).
     Each letter keeps the exact advance it had in the original text, so
     kerning holds while rolling too.
   DzRoll.box(el, "out" | "in")   → { set(v) }
     The same move for an image (seal, mark): it slides up through a
     window the size of its own box.
   No dependencies; the motion is driven by whoever calls set() (GSAP). */
(function () {
  "use strict";

  var UP = "DESIGNTUOWRKAMVC", LOW = "designtuowrkamvc", DIG = "0123456789";
  var ROWS = 4; // real, two others, blank
  var live = [];

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function ease(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }
  function pick(ch, i, k) {
    var pool = /[0-9]/.test(ch) ? DIG : ch === ch.toLowerCase() && ch !== ch.toUpperCase() ? LOW : UP;
    return pool[(i * 7 + k * 5 + ch.charCodeAt(0)) % pool.length];
  }

  function textNodes(el) {
    var out = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    while (w.nextNode()) if (/\S/.test(w.currentNode.nodeValue)) out.push(w.currentNode);
    return out;
  }

  function text(el, dir) {
    var split = null, last = -1;

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
      var flat = [];
      plan.forEach(function (items) { items.forEach(function (it) { if (it.w != null) flat.push(it); }); });
      flat.forEach(function (it, j) {
        var nx = flat[j + 1];
        it.adv = nx && Math.abs(nx.top - it.top) < 2 && nx.left > it.left ? nx.left - it.left : it.w;
      });
      // 2. swap the text for letter windows
      nodes.forEach(function (tn, ni) {
        var fs = parseFloat(getComputedStyle(tn.parentNode).fontSize) || 16; // widths in this text's em
        var frag = document.createDocumentFragment(), buf = "";
        function flush() { if (buf) { frag.appendChild(document.createTextNode(buf)); buf = ""; } }
        plan[ni].forEach(function (it, k) {
          if (it.w == null) { buf += it.ch; return; }
          // a space after this letter keeps its own width as text
          var nextSpace = plan[ni][k + 1] && plan[ni][k + 1].w == null;
          flush();
          var c = document.createElement("span");
          c.className = "rc";
          var wpx = nextSpace ? it.w : it.adv;
          c.style.width = (wpx / fs).toFixed(4) + "em";
          var wrap = document.createElement("span");
          wrap.className = "rc-w";
          var rows = dir === "out" ? [it.ch, pick(it.ch, it.idx, 1), pick(it.ch, it.idx, 2), " "]
                                   : [" ", pick(it.ch, it.idx, 1), pick(it.ch, it.idx, 2), it.ch];
          wrap.textContent = rows[0];
          for (var r = 1; r < ROWS; r++) {
            var row = document.createElement("span");
            row.className = "rc-r";
            row.style.top = r + "em";
            row.textContent = rows[r];
            wrap.appendChild(row);
          }
          c.appendChild(wrap);
          frag.appendChild(c);
          cells.push(wrap);
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
      // every text node was replaced by a run of siblings; rebuild from the
      // letter windows' own text (row 0 is the real letter for "out",
      // row 3 for "in"), which is exactly the original text
      var cells = el.querySelectorAll(".rc");
      [].forEach.call(cells, function (c) {
        var w = c.firstChild, ch = dir === "out" ? w.firstChild.nodeValue : w.lastChild.textContent;
        c.parentNode.replaceChild(document.createTextNode(ch), c);
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
        var q = ease(clamp01((v - start) / (1 - spread)));
        cs[i].style.setProperty("--r", q.toFixed(4));
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
  function box(el, dir) {
    var last = -1;
    return {
      set: function (v) {
        v = clamp01(v);
        if (v === last) return;
        last = v;
        var e = ease(v);
        if (dir === "out") {
          if (e <= 0) { el.style.clipPath = el.style.translate = ""; return; }
          el.style.translate = "0 " + (-e * 100).toFixed(2) + "%";
          el.style.clipPath = "inset(" + (e * 100).toFixed(2) + "% -2px -2px -2px)";
        } else {
          if (e >= 1) { el.style.clipPath = el.style.translate = ""; return; }
          el.style.translate = "0 " + ((1 - e) * 100).toFixed(2) + "%";
          el.style.clipPath = "inset(-2px -2px " + ((1 - e) * 100).toFixed(2) + "% -2px)";
        }
      }
    };
  }

  // the font arriving changes every advance: measure again
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { live.slice().forEach(function (r) { r.resplit(); }); });
  }

  window.DzRoll = { text: text, box: box };
})();
