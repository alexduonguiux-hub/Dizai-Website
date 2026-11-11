/* Dot cursor (see "Cursor" in style.css). Turned on only after the first
   real mouse move, so the system cursor is never hidden without a
   replacement; touch and pen input keep their default behaviour. */
(function () {
  "use strict";
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  var root = document.documentElement;
  var dots = document.querySelectorAll(".cursor");
  if (!dots.length) return;

  function place(x, y) {
    var t = "translate3d(" + x + "px," + y + "px,0)";
    for (var i = 0; i < dots.length; i++) dots[i].style.transform = t;
  }

  window.addEventListener("pointermove", function (e) {
    if (e.pointerType !== "mouse") return;
    place(e.clientX, e.clientY);
    root.classList.add("has-cursor");
    root.classList.remove("cursor-away");
    var link = e.target.closest && e.target.closest("a, button");
    root.classList.toggle("cursor-on-link", !!link);
  }, { passive: true });

  document.addEventListener("pointerleave", function () { root.classList.add("cursor-away"); });
  window.addEventListener("blur", function () { root.classList.add("cursor-away"); });
})();
