/* Loading screen (Figma "Loading" 13:257)
   1. Rolling count 0 → 100% (digits slide up), following real load progress: it can climb
      to 90% on time alone and only reaches 100% after window "load".
   2. At 100% the whole screen turns into a WebGL curtain — the loader is
      painted onto a cloth mesh that parts in the middle and is drawn to both
      sides, pleating as it bunches up, hem trailing the top rail.
   Falls back to a fade without WebGL, and skips motion for
   prefers-reduced-motion. */
(function () {
  "use strict";

  var root = document.documentElement;
  var loader = document.querySelector(".loader");
  if (!loader || !root.classList.contains("is-loading")) return;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var MIN_MS = reduce ? 300 : 1800; // shortest time from 0 to 100
  var HOLD_MS = reduce ? 0 : 350;   // pause on 100% before the curtain
  var CURTAIN_MS = 2000;
  var SETTLE_MS = reduce ? 0 : 400;  // matches .is-settled transition in CSS

  /* ---------------- Rolling counter ---------------- */

  /* Text metrics in em, from the count's own font on a canvas. Returns
     null until the web font is ready (never cache fallback metrics). */
  var metricsCtx = document.createElement("canvas").getContext("2d");
  var metricsCache = {};
  function advance(t) {
    if (!t) return 0;
    if (!(t in metricsCache)) {
      var cs = getComputedStyle(countEl);
      metricsCtx.font = cs.fontStyle + " " + cs.fontWeight + " 100px " + cs.fontFamily;
      if (!document.fonts.check(metricsCtx.font)) return null;
      metricsCache[t] = metricsCtx.measureText(t).width / 100;
    }
    return metricsCache[t];
  }
  // Separate cells lose the font's kerning ("10" is tighter than "1" + "0");
  // it comes back as a margin on the right-hand cell.
  function kern(a, b) {
    if (!a || !b) return 0;
    var ab = advance(a + b), wa = advance(a), wb = advance(b);
    return ab === null || wa === null || wb === null ? null : ab - wa - wb;
  }

  function RollCell(host, onTarget) {
    var el = document.createElement("span");
    el.className = "roll";
    el.innerHTML = '<span class="roll-cur"></span><span class="roll-next" data-gl-skip></span>';
    host.appendChild(el);
    var curEl = el.children[0], nextEl = el.children[1];
    var cell = { el: el, target: "" };
    var cur = "", pending = null, busy = false;

    function roll(to) {
      busy = true;
      cell.target = to;
      onTarget();               // width and kerning ease toward the new digit
      nextEl.textContent = to;
      el.classList.remove("is-rolling");
      void el.offsetWidth;      // restart the animation
      el.classList.add("is-rolling");
    }
    nextEl.addEventListener("animationend", function () {
      cur = nextEl.textContent;
      curEl.textContent = cur;
      el.classList.remove("is-rolling");
      busy = false;
      // the counter outruns the roll on the units digit: go straight to
      // the latest value rather than queueing every step
      if (pending !== null && pending !== cur) { var d = pending; pending = null; roll(d); }
      else pending = null;
    });

    cell.set = function (d) {
      if (reduce) { cur = curEl.textContent = cell.target = d; onTarget(); return; }
      if (busy) { pending = d; return; }
      if (d !== cur) roll(d);
    };
    cell.idle = function () { return !busy && pending === null; };
    return cell;
  }

  var countEl = loader.querySelector(".loader-count");
  countEl.textContent = "";
  var cells = [];
  var pctEl = document.createElement("span");
  pctEl.className = "roll-pct";
  pctEl.textContent = "%";

  /* While counting, every digit cell has the same width (the widest digit),
     so the row never shifts sideways as narrow and wide digits pass through.
     At 100% the cells ease once to each digit's real width plus the font's
     kerning, which is how Figma sets "100%". Width and margin transitions
     live in CSS. */
  var settled = false;
  var finalDigits = ["1", "0", "0"]; // where the row ends up
  var digitW = null;
  function widestDigit() {
    if (digitW === null) {
      var w = 0;
      for (var i = 0; i <= 9; i++) {
        var a = advance(String(i));
        if (a === null) return null;
        w = Math.max(w, a);
      }
      digitW = w;
    }
    return digitW;
  }
  function layout() {
    var prev = "", tab = widestDigit();
    for (var i = 0; i < cells.length; i++) {
      // once settling, aim straight at the final "100%" so a digit still
      // rolling 9 → 0 can't retarget the move halfway
      var d = settled ? finalDigits[i] : cells[i].target;
      var w = settled ? advance(d) : (d ? tab : 0);
      var k = settled ? kern(prev, d) : 0;
      if (w !== null) cells[i].el.style.width = w + "em";
      if (k !== null) cells[i].el.style.marginLeft = k + "em";
      if (d) prev = d;
    }
    var kp = settled ? kern(prev, "%") : 0;
    if (kp !== null) pctEl.style.marginLeft = kp + "em";
  }
  function settle() {
    settled = true;
    countEl.classList.add("is-settled");
    layout();
  }
  for (var c = 0; c < 3; c++) cells.push(RollCell(countEl, layout));
  countEl.appendChild(pctEl);
  document.fonts.ready.then(layout);

  function showCount(n) {
    var s = String(n);
    while (s.length < 3) s = " " + s;
    if (n >= 100 && !settled) {
      // last roll eases out, and the leading 1 arrives straight into
      // Figma's spacing: one sideways move instead of two
      countEl.classList.add("is-final");
      settle();
    }
    for (var i = 0; i < 3; i++) cells[i].set(s[i] === " " ? "" : s[i]);
  }
  showCount(0);

  /* ---------------- Progress ---------------- */

  var start = performance.now();
  var loaded = document.readyState === "complete";
  var shown = 0;
  window.addEventListener("load", function () { loaded = true; });

  function tick(now) {
    var t = Math.min(1, (now - start) / MIN_MS);
    var target = (1 - Math.pow(1 - t, 3)) * 100; // ease-out
    if (!loaded) target = Math.min(target, 90);
    shown += (target - shown) * 0.2;             // a late "load" eases in
    if (target - shown < 0.5) shown = target;
    var value = Math.floor(shown);
    showCount(value);
    if (value >= 100) return waitForDigits();
    requestAnimationFrame(tick);
  }

  function waitForDigits() {
    if (cells.every(function (c) { return c.idle(); })) {
      setTimeout(reveal, SETTLE_MS + HOLD_MS);   // let the settle finish
    } else requestAnimationFrame(waitForDigits);
  }

  /* ---------------- Reveal ---------------- */

  function cleanup() {
    root.classList.remove("is-loading", "is-loaded", "is-curtain");
    loader.remove();
  }

  function fadeOut() {
    root.classList.add("is-loaded");
    var done = false;
    function end() { if (!done) { done = true; cleanup(); } }
    if (reduce) return end();
    loader.addEventListener("transitionend", end);
    setTimeout(end, 800);
  }

  function reveal() {
    loader.classList.add("is-done"); // dots stop, fully shown, for the paint
    if (reduce) return fadeOut();
    var curtain = null;
    try { curtain = Curtain(paintLoader()); } catch (e) { curtain = null; }
    if (!curtain) return fadeOut();
    curtain.open(CURTAIN_MS, cleanup);
  }

  /* Paint the loader as it looks right now onto a 2D canvas: every visible
     text node at its own position (so kerning and the rolling digit cells
     match the DOM exactly) and every image at its box. */
  function paintLoader() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = window.innerWidth, H = window.innerHeight;
    var c = document.createElement("canvas");
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    var ctx = c.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.fillStyle = getComputedStyle(loader).backgroundColor;
    ctx.fillRect(0, 0, W, H);

    var walker = document.createTreeWalker(loader, NodeFilter.SHOW_TEXT);
    var range = document.createRange();
    for (var node = walker.nextNode(); node; node = walker.nextNode()) {
      var text = node.nodeValue.replace(/\s+/g, " ").trim();
      var el = node.parentElement;
      if (!text || el.closest("[data-gl-skip]")) continue;
      var cs = getComputedStyle(el);
      if (cs.visibility === "hidden") continue;
      if (cs.textTransform === "uppercase") text = text.toUpperCase();
      var size = parseFloat(cs.fontSize);
      ctx.font = cs.fontStyle + " " + cs.fontWeight + " " + size + "px " + cs.fontFamily;
      ctx.fillStyle = cs.color;
      ctx.textBaseline = "alphabetic";
      range.selectNodeContents(node);
      var r = range.getBoundingClientRect();
      // the text's content area starts at the font ascender (960 / 1000)
      ctx.fillText(text, r.left, r.top + 0.96 * size);
    }
    loader.querySelectorAll("img").forEach(function (img) {
      var r = img.getBoundingClientRect();
      ctx.drawImage(img, r.left, r.top, r.width, r.height);
    });
    return c;
  }

  /* ---------------- WebGL curtain ---------------- */

  var VS = [
    "attribute vec2 aUV;",      // u: 0 outer edge → 1 centre seam; v: 0 top → 1 hem
    "attribute float aSide;",   // -1 left half, +1 right half
    "uniform float uP;",        // 0 closed → 1 fully drawn aside
    "uniform float uT;",        // seconds, for the flutter
    "uniform float uN;",        // pleats per half, from the screen width
    "varying vec2 vTex;",
    "varying float vShade;",
    "void main() {",
    "  float u = aUV.x, v = aUV.y;",
    // the rail pulls the top first; the hem follows a beat later
    "  float lag = 0.3;",
    "  float pp = clamp((uP - v * lag) / (1.0 - lag), 0.0, 1.0);",
    "  float e = pp * pp * (3.0 - 2.0 * pp);",
    // bunch the cloth toward the outer edge, then carry it off screen
    "  float g = 1.0 - 0.84 * e;",
    "  float off = -0.26 * smoothstep(0.45, 1.0, pp);",
    "  float X = off + u * 0.5 * g;",
    // pleats deepen as the cloth gathers; a little life at the leading edge
    "  float k = 6.2831853 * uN;",
    "  float A = (0.11 / uN) * e * (0.75 + 0.25 * v);",
    "  float s = sin(u * k), c = cos(u * k);",
    "  float bell = sin(3.14159265 * pp);",
    "  float z = A * s + 0.006 * sin(uT * 4.0 + v * 7.0) * bell * u;",
    "  float slope = 0.45 * (A * k * c) / (0.5 * max(g, 0.05));",
    "  vec3 n = normalize(vec3(-slope * -aSide, 0.0, 1.0));",
    "  vec3 L = normalize(vec3(-0.45, 0.25, 1.0));",
    // flat cloth shades to exactly 1.0, so frame 0 matches the DOM loader
    "  float shade = 1.0 + (dot(n, L) - L.z) * 1.15;",
    "  shade -= 0.22 * e * smoothstep(0.82, 1.0, u);",       // seam edge turns away
    "  shade -= 0.10 * e * (1.0 - smoothstep(0.0, 0.15, u));", // folds stacked at the side
    "  shade = clamp(shade, 0.62, 1.06);",
    "  float Y = v - 0.015 * bell * v * v;",                   // hem lifts as it swings
    "  if (aSide > 0.0) X = 1.0 - X;",
    "  vTex = vec2(aSide > 0.0 ? 1.0 - u * 0.5 : u * 0.5, v);",
    "  vShade = shade;",
    "  float w = 1.0 - z * 1.3;",
    "  gl_Position = vec4(X * 2.0 - 1.0, 1.0 - Y * 2.0, -z, w);",
    "}"
  ].join("\n");

  var FS = [
    "precision mediump float;",
    "uniform sampler2D uTex;",
    "varying vec2 vTex;",
    "varying float vShade;",
    "void main() {",
    "  vec3 c = texture2D(uTex, vTex).rgb;",
    "  gl_FragColor = vec4(c * vShade, 1.0);",
    "}"
  ].join("\n");

  function Curtain(texCanvas) {
    var canvas = document.createElement("canvas");
    canvas.className = "curtain";
    var gl = canvas.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: true });
    if (!gl) return null;

    function shader(type, src) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      return sh;
    }
    var prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);

    // two halves, each a (COLS × ROWS) grid
    var COLS = 180, ROWS = 48, verts = [], idx = [];
    [-1, 1].forEach(function (side, h) {
      var base = h * (COLS + 1) * (ROWS + 1);
      for (var j = 0; j <= ROWS; j++)
        for (var i = 0; i <= COLS; i++) verts.push(i / COLS, j / ROWS, side);
      for (j = 0; j < ROWS; j++)
        for (i = 0; i < COLS; i++) {
          var a = base + j * (COLS + 1) + i, b = a + 1, c = a + COLS + 1, d = c + 1;
          idx.push(a, b, c, b, d, c);
        }
    });
    var vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
    var ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    var aUV = gl.getAttribLocation(prog, "aUV"), aSide = gl.getAttribLocation(prog, "aSide");
    gl.enableVertexAttribArray(aUV);
    gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 12, 0);
    gl.enableVertexAttribArray(aSide);
    gl.vertexAttribPointer(aSide, 1, gl.FLOAT, false, 12, 8);

    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, texCanvas); // throws if tainted

    var uP = gl.getUniformLocation(prog, "uP"), uT = gl.getUniformLocation(prog, "uT");
    // about one pleat per 90 CSS px of each half
    gl.uniform1f(gl.getUniformLocation(prog, "uN"), Math.max(3, Math.round(window.innerWidth / 2 / 90)));
    canvas.width = texCanvas.width;
    canvas.height = texCanvas.height;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);

    function draw(p, t) {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniform1f(uP, p);
      gl.uniform1f(uT, t);
      gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
    }

    return {
      open: function (ms, onDone) {
        document.body.appendChild(canvas);
        draw(0, 0);
        root.classList.add("is-curtain"); // hide the DOM loader under frame 0
        var t0 = performance.now();
        (function frame() {
          var now = performance.now();
          var t = Math.min(1, (now - t0) / ms);
          var p = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // ease-in-out
          draw(p, (now - t0) / 1000);
          if (t < 1) return requestAnimationFrame(frame);
          canvas.remove();
          var lose = gl.getExtension("WEBGL_lose_context");
          if (lose) lose.loseContext();
          onDone();
        })();
      }
    };
  }

  requestAnimationFrame(tick);
})();
