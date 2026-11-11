/* Loading screen: counts 0 → 100% while the page loads, then fades out.
   The count follows real progress: it can climb to 90% on time alone and
   only reaches 100% once window "load" has fired (fonts, seal, CSS). */
(function () {
  var root = document.documentElement;
  var loader = document.querySelector(".loader");
  if (!loader || !root.classList.contains("is-loading")) return;
  var count = loader.querySelector(".loader-count");

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var MIN_MS = reduce ? 300 : 1600; // shortest time from 0 to 100
  var HOLD_MS = reduce ? 0 : 250;   // pause on 100% before fading
  var start = performance.now();
  var loaded = document.readyState === "complete";
  var shown = 0;

  window.addEventListener("load", function () { loaded = true; });

  function tick(now) {
    var t = Math.min(1, (now - start) / MIN_MS);
    var target = (1 - Math.pow(1 - t, 3)) * 100; // ease-out
    if (!loaded) target = Math.min(target, 90);
    // ease the shown value toward the target so a late "load" doesn't jump
    shown += (target - shown) * 0.2;
    if (target - shown < 0.5) shown = target;
    var value = Math.floor(shown);
    count.textContent = value + "%";
    if (value >= 100) {
      setTimeout(finish, HOLD_MS);
      return;
    }
    requestAnimationFrame(tick);
  }

  function finish() {
    root.classList.add("is-loaded");
    var done = false;
    function remove() {
      if (done) return;
      done = true;
      root.classList.remove("is-loading", "is-loaded");
      loader.remove();
    }
    if (reduce) return remove();
    loader.addEventListener("transitionend", remove);
    setTimeout(remove, 800); // in case transitionend never fires
  }

  requestAnimationFrame(tick);
})();
