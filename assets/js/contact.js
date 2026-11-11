/* Contact (Figma 10:1546): everything rolls in when the page opens, the
   same letters-rolling move as the rest of the site (assets/js/roll.js);
   the "đs" mark and the big ✱ slide up through their windows. Going to
   another page of the site, it all rolls away first. */
(function () {
  "use strict";
  var root = document.documentElement;
  var Roll = window.DzRoll, gsap = window.gsap;
  function done() { root.classList.remove("is-entering"); }
  if (!Roll || !gsap) return done();

  var q = function (s) { return [].slice.call(document.querySelectorAll(s)); };
  // in the order they come in: the middle first, then the frame around it
  var texts = [".cp-kicker", ".cp-email", ".cp-city .cp-l", ".cp-social", ".nav-list", ".cp-info", ".cp-copy"]
    .reduce(function (all, s) { return all.concat(q(s)); }, [])
    .filter(function (el) { return el.getClientRects().length; });
  var boxes = [".cp-star", ".cp-mark"].reduce(function (all, s) { return all.concat(q(s)); }, []);
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function enter() {
    var rs = texts.map(function (el) { var r = Roll.text(el, "in"); r.set(0); return r; })
      .concat(boxes.map(function (el) { var r = Roll.box(el, "in"); r.set(0); return r; }));
    done();
    if (reduce) { rs.forEach(function (r) { r.set(1); }); return; }
    rs.forEach(function (r, i) {
      var o = { v: 0 };
      gsap.to(o, { v: 1, duration: 0.8, delay: 0.1 + i * 0.07, ease: "none",
                   onUpdate: function () { r.set(o.v); } });
    });
  }
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(enter);

  // going to the rest of the site: roll away first
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    var url = new URL(a.href, location.href);
    if (url.origin !== location.origin || a.target) return;           // other sites, mail, phone
    if (url.pathname === location.pathname && !url.hash) return;      // this page
    e.preventDefault();
    Roll.leave(url.href, texts, boxes);
  });
})();
