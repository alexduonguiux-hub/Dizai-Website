/* The logo mark as a real 3D object (three.js, vendored in assets/vendor).
   The seal's SVG outline is extruded into a thin, bevelled plate of polished
   silver (physically based metal) lit by a soft room environment plus one
   key light, so highlights run along the edges of every letter as it turns.

   One canvas follows whichever seal is on screen: the big loader seal (and
   it flies with it during the hand-off), then the coin's slot on Home, where
   it turns slowly on its vertical axis once loading is over. The CSS seals
   stay in the page for layout and as the fallback; they are only hidden once
   the 3D seal has rendered its first frame. */
import * as THREE from "../vendor/three/three.module.min.js";
import { SVGLoader } from "../vendor/three/SVGLoader.js";

const root = document.documentElement;
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const TURN_MS = 9000;      // one revolution on Home
const PAD = 0.12;          // canvas margin around the seal, for the turn's perspective

const coinEl = document.querySelector(".type-row .seal-coin");
const loaderSeal = document.querySelector(".loader .seal");
const img = coinEl && coinEl.querySelector("img.seal");

async function start() {
  if (!coinEl || !img) return;
  const probe = document.createElement("canvas");
  if (!(probe.getContext("webgl2") || probe.getContext("webgl"))) return;

  // ---- geometry: the SVG outline, extruded and bevelled ----
  const svgText = await (await fetch(img.currentSrc || img.src)).text();
  const data = new SVGLoader().parse(svgText);
  const shapes = [];
  data.paths.forEach((p) => SVGLoader.createShapes(p).forEach((s) => shapes.push(s)));
  if (!shapes.length) return;

  const vb = (svgText.match(/viewBox="([^"]+)"/) || [])[1];
  const [, , W, H] = (vb || "0 0 198.927 231").split(/\s+/).map(Number);
  // a rounded, cast-metal profile: the bevel takes most of each stroke's
  // half-width, so every stroke is a curved ridge that catches light in bands
  const depth = H * 0.006, bevelT = H * 0.011, bevelS = H * 0.0085;
  const geo = new THREE.ExtrudeGeometry(shapes, {
    depth, curveSegments: 12, steps: 1,
    bevelEnabled: true, bevelThickness: bevelT, bevelSize: bevelS, bevelOffset: -bevelS * 0.35, bevelSegments: 8
  });
  geo.translate(-W / 2, -H / 2, -depth / 2);
  geo.computeVertexNormals();

  // ---- scene ----
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const canvas = renderer.domElement;
  canvas.className = "seal-3d";
  canvas.setAttribute("aria-hidden", "true");

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studio(), 0.0).texture;

  // polished chrome-silver: mirror-smooth, so the studio strips read as
  // crisp bright bands against dark reflections
  const silver = new THREE.MeshPhysicalMaterial({
    color: 0xf2f3f5, metalness: 1, roughness: 0.06,
    clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.35
  });
  const mesh = new THREE.Mesh(geo, silver);
  mesh.scale.set(1, -1, 1); // SVG is y-down
  const pivot = new THREE.Group();
  pivot.add(mesh);
  scene.add(pivot);

  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(-1.2, 1.4, 2.2);
  scene.add(key);

  // perspective camera framing the seal's height (plus padding)
  const FOV = 18;
  const camera = new THREE.PerspectiveCamera(FOV, W / H, 1, 5000);
  const dist = ((H * (1 + 2 * PAD)) / 2) / Math.tan((FOV * Math.PI) / 360);
  camera.position.set(0, 0, dist);
  camera.lookAt(0, 0, 0);

  canvas.style.cssText = "position:fixed;left:0;top:0;pointer-events:none;z-index:101;visibility:hidden";
  document.body.appendChild(canvas);

  let bufH = 0, shown = false, turnT0 = null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  function anchor() {
    if (loaderSeal && loaderSeal.isConnected && loaderSeal.style.visibility !== "hidden") return loaderSeal;
    return coinEl;
  }

  function frame(now) {
    const a = anchor();
    const r = a.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      const ph = r.height * (1 + 2 * PAD), pw = ph * (W / H);
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      canvas.style.left = (cx - pw / 2) + "px";
      canvas.style.top = (cy - ph / 2) + "px";
      canvas.style.width = pw + "px";
      canvas.style.height = ph + "px";
      // reallocate the buffer only when the size has changed a lot
      const want = Math.ceil(ph * dpr);
      if (!bufH || want > bufH * 1.05 || want < bufH * 0.7) {
        bufH = want;
        renderer.setPixelRatio(1);
        renderer.setSize(Math.ceil(want * (W / H)), want, false);
        camera.aspect = W / H;
        camera.updateProjectionMatrix();
      }

      // turn only on Home, starting from 0° when the loader has gone
      let angle = 0;
      if (!root.classList.contains("is-loading") && !reduce) {
        if (turnT0 === null) turnT0 = now;
        angle = ((now - turnT0) / TURN_MS) * Math.PI * 2;
      }
      if (typeof window.dzSealAngle === "number") angle = window.dzSealAngle; // test hook (radians)
      pivot.rotation.y = angle;
      renderer.render(scene, camera);

      if (!shown) {
        shown = true;
        canvas.style.visibility = "";
        root.classList.add("has-seal-3d"); // hide the flat seals underneath
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* The world the chrome reflects, built as a shader-painted sky sphere:
   a bright sky fading towards a crisp horizon, a dark ground below it with a
   thin glow line just under the horizon, and two tall softbox strips at the
   sides. Flat faces looking straight back at the viewer straddle that
   horizon, so each stroke gets the classic chrome split: bright band above,
   deep reflection below; the rounded edges sweep through all of it. */
function studio() {
  const env = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(10, 64, 32), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: "varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: [
      "varying vec3 vDir;",
      "void main(){",
      "  vec3 d = normalize(vDir);",
      "  float y = d.y;",
      "  float az = atan(d.x, d.z);",
      "  float skyMask = smoothstep(-0.006, 0.006, y - 0.01);",
      "  vec3 skyC = mix(vec3(0.62), vec3(0.22), smoothstep(0.0, 0.5, y));",       // mid silver, darker overhead
      "  vec3 ground = mix(vec3(0.02), vec3(0.12), smoothstep(-0.05, -0.8, y));",
      "  vec3 c = mix(ground, skyC, skyMask);",
      "  c += vec3(3.2) * exp(-pow((y - 0.06) / 0.012, 2.0));",                    // bright band just above the horizon
      "  c += vec3(1.6) * exp(-pow((y + 0.035) / 0.008, 2.0));",                   // glow line under the horizon
      "  c += vec3(3.0) * smoothstep(0.09, 0.05, abs(az - 1.2)) * smoothstep(-0.5, -0.2, y);",   // softbox right
      "  c += vec3(2.4) * smoothstep(0.07, 0.04, abs(az + 1.35)) * smoothstep(-0.5, -0.2, y);",  // softbox left
      "  gl_FragColor = vec4(c, 1.0);",
      "}"
    ].join("\n")
  }));
  env.add(sky);
  return env;
}

start().catch(() => { /* keep the CSS seal */ });
