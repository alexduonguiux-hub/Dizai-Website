/* Contact (Figma 10:1546): everything rolls in when the page opens, the
   same letters-rising move as the rest of the site (assets/js/roll.js);
   the "đs" mark rises with them. Going to
   another page of the site, it all rolls away first. */
(function () {
  "use strict";
  var root = document.documentElement;
  var Roll = window.DzRoll, gsap = window.gsap;
  function done() { root.classList.remove("is-entering"); }
  if (!Roll || !gsap) return done();

  var q = function (s) { return [].slice.call(document.querySelectorAll(s)); };
  // in the order they come in: the middle first, then the frame around it
  // (not the menu: it stays as it is from page to page)
  var texts = [".cp-kicker", ".cp-email", ".cp-social", ".cp-info", ".cp-copy"]
    .reduce(function (all, s) { return all.concat(q(s)); }, [])
    .filter(function (el) { return el.getClientRects().length; });
  var boxes = [".cp-mark"].reduce(function (all, s) { return all.concat(q(s)); }, []);
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // from Work / About the mark was already here: it stays and turns over
  var keepMark = Roll.takeFlip && Roll.takeFlip();
  function enter() {
    var rs = texts.map(function (el) { var r = Roll.text(el, "in"); r.set(0); return r; })
      .concat(keepMark ? [] : boxes.map(function (el) { var r = Roll.box(el, "in"); r.set(0); return r; }));
    done();
    if (keepMark) Roll.flip(boxes);
    if (reduce) { rs.forEach(function (r) { r.set(1); }); return; }
    rs.forEach(function (r, i) {
      var o = { v: 0 };
      gsap.to(o, { v: 1, duration: 0.8, delay: 0.1 + i * 0.07 + (window.DzRoll && DzRoll.wait ? DzRoll.wait() : 0), ease: "none",
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

  /* Scrolling back up goes back to Work: Contact sits right after it
     (DzRoll.gate: only from the top the page already rests at, and only a
     deliberate push; rolling away first, like the WORK link) */
  var gone = false;
  function back() {
    if (gone) return;
    gone = true;
    Roll.leave(new URL(document.body.dataset.up || "../#work", location.href).href, texts, boxes);
  }
  Roll.gate({
    scroller: document.scrollingElement, prev: back, prevLabel: "Work",
    push: function () { return [].slice.call(document.querySelectorAll(".cp-center, .cp-copy")); },
    pieces: function () { return { texts: texts.filter(function (el) { return !el.matches("address.contact"); }) }; }
  });
})();
