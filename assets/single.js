import * as THREE from "../vendor/packages/three/three.module.min.js";

const animationLibrary = import("../vendor/packages/animejs/anime.esm.min.js").catch(() => null);
const body = document.body;
const aboutMode = body.classList.contains("about-page");
const canvas = document.querySelector("#quantum-field");
const loader = document.querySelector("[data-loader]");
const loaderBar = document.querySelector("[data-loader-bar]");
const cursor = document.querySelector("[data-cursor]");
const titleLines = document.querySelectorAll(".title__line > span");
const creditWords = document.querySelectorAll(".credit > *");
const revealElements = document.querySelectorAll("[data-reveal]");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const coarsePointer = window.matchMedia("(pointer: coarse)");

const state = {
  live: !reduceMotion.matches,
  pointer: new THREE.Vector2(0.68, 0.5),
  target: new THREE.Vector2(0.68, 0.5),
  previous: new THREE.Vector2(0.68, 0.5),
  velocity: 0,
};

let renderer;
let material;
let lastFrame = performance.now();

if (!reduceMotion.matches) {
  canvas.style.opacity = "0.18";
  canvas.style.transform = "scale(1.075)";
  titleLines.forEach((line) => {
    line.style.opacity = "0";
    line.style.transform =
      "translateY(112%) rotateX(-38deg) skewX(-7deg) scaleX(.88)";
  });
  creditWords.forEach((word) => {
    word.style.opacity = "0";
    word.style.transform = "translateY(12px)";
  });
}

function hasWebGL() {
  try {
    const test = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (test.getContext("webgl") || test.getContext("experimental-webgl")),
    );
  } catch {
    return false;
  }
}

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;

  uniform float uTime;
  uniform float uVelocity;
  uniform float uColour;
  uniform float uAbout;
  uniform vec2 uResolution;
  uniform vec2 uPointer;
  varying vec2 vUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float packet(vec2 p, vec2 centre, float spread, float frequency, float speed, float phase) {
    vec2 q = p - centre;
    float envelope = exp(-dot(q, q) / spread);
    return envelope * sin(q.x * frequency + sin(q.y * 1.8 + phase) * 1.7 - uTime * speed + phase);
  }

  vec3 phasePalette(float t) {
    t = fract(t) * 7.0;
    vec3 cobalt = vec3(0.05, 0.24, 1.00);
    vec3 cyan = vec3(0.08, 0.92, 1.00);
    vec3 lime = vec3(0.58, 1.00, 0.24);
    vec3 gold = vec3(1.00, 0.74, 0.10);
    vec3 coral = vec3(1.00, 0.23, 0.25);
    vec3 magenta = vec3(1.00, 0.08, 0.63);
    vec3 violet = vec3(0.47, 0.18, 1.00);

    if (t < 1.0) return mix(cobalt, cyan, t);
    if (t < 2.0) return mix(cyan, lime, t - 1.0);
    if (t < 3.0) return mix(lime, gold, t - 2.0);
    if (t < 4.0) return mix(gold, coral, t - 3.0);
    if (t < 5.0) return mix(coral, magenta, t - 4.0);
    if (t < 6.0) return mix(magenta, violet, t - 5.0);
    return mix(violet, cobalt, t - 6.0);
  }

  void main() {
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 p = vUv * 2.0 - 1.0;
    p.x *= aspect;

    vec2 mouse = uPointer * 2.0 - 1.0;
    mouse.x *= aspect;
    vec2 toMouse = p - mouse;
    float mouseDistance = length(toMouse);
    float rippleEnvelope = exp(-mouseDistance * mouseDistance * 54.4);
    rippleEnvelope *= smoothstep(0.00625, 0.03, mouseDistance);

    float ripplePhase = mouseDistance * 152.0 - uTime * 4.4;
    float movingRipple = sin(ripplePhase) * rippleEnvelope;
    float rippleLine = pow(0.5 + 0.5 * cos(ripplePhase), 18.0) * rippleEnvelope;
    float interaction = mix(1.0, 0.28, uAbout);
    p += normalize(toMouse + vec2(0.0001)) * movingRipple * (0.009 + uVelocity * 0.022) * interaction;
    p += mouse * vec2(0.032, -0.018) * interaction;

    float slow = uTime * 0.28;
    vec2 c1 = vec2(0.52 + sin(slow) * 0.13, 0.28 + cos(slow * 0.8) * 0.1);
    vec2 c2 = vec2(-0.36 + cos(slow * 0.7) * 0.12, -0.05 + sin(slow) * 0.09);
    vec2 c3 = vec2(0.12 + mouse.x * 0.14, -0.5 + mouse.y * 0.08);
    float edgeX = max(0.68, aspect * 0.78);
    vec2 c4 = vec2(edgeX + sin(slow * 0.62) * 0.08, 0.02 + cos(slow * 0.74) * 0.13);
    vec2 c5 = vec2(-edgeX + cos(slow * 0.58) * 0.08, 0.16 + sin(slow * 0.68) * 0.12);
    float ambientPhase = uTime * 0.1;
    float ambientField = 0.0;
    ambientField += sin(p.x * 2.25 + sin(p.y * 1.15 + ambientPhase) * 0.75 - ambientPhase) * 0.22;
    ambientField += cos(p.y * 2.0 - cos(p.x * 1.25 - ambientPhase) * 0.68 + ambientPhase * 0.7) * 0.14;
    ambientField += sin((p.x - p.y) * 1.65 + ambientPhase * 0.5) * 0.09;

    float psi = 0.0;
    psi += ambientField * 0.72;
    psi += packet(p, c1, 0.58, 12.0, 1.12, 0.0);
    psi += packet(p.yx, c2.yx, 0.74, 10.0, -0.8, 1.6);
    psi += packet(p, c3, 0.39, 15.0, 1.45, 3.2);
    psi += packet(p, c4, 0.66, 11.5, -0.92, 2.3) * 0.72;
    psi += packet(p.yx, c5.yx, 0.68, 12.6, 0.86, 4.2) * 0.72;

    float r1 = length(p - c1);
    float r2 = length(p - c2);
    float r4 = length(p - c4);
    float r5 = length(p - c5);
    psi += sin(r1 * 27.0 - uTime * 1.35) * exp(-r1 * 1.8) * 0.42;
    psi += sin(r2 * 22.0 + uTime) * exp(-r2 * 1.45) * 0.38;
    psi += sin(r4 * 23.5 + uTime * 0.92) * exp(-r4 * 1.55) * 0.28;
    psi += sin(r5 * 24.5 - uTime * 0.84) * exp(-r5 * 1.55) * 0.28;
    psi += movingRipple * (0.14 + uVelocity * 0.2);

    float amplitude = abs(psi);
    float density = smoothstep(0.045, 0.9, amplitude);
    float contourBase = abs(fract(psi * 4.8 + r1 * 1.9) - 0.5) * 2.0;
    float contours = pow(1.0 - contourBase, 9.0);
    float fineBase = abs(fract((psi + r2) * 12.0) - 0.5) * 2.0;
    float fine = pow(1.0 - fineBase, 18.0) * smoothstep(0.03, 0.62, amplitude);

    vec3 colour = vec3(0.008, 0.011, 0.052);
    float phase = 0.58 + psi * 0.23 + r1 * 0.055 + uPointer.x * 0.1 + uTime * 0.008;
    vec3 phaseColour = phasePalette(phase);
    vec3 secondColour = phasePalette(phase + 0.46 + r2 * 0.04);
    float ambientDensity = smoothstep(0.02, 0.34, abs(ambientField));
    vec3 lineColour = mix(
      vec3(0.08, 0.94, 1.0),
      vec3(0.70, 1.0, 0.24),
      smoothstep(-0.5, 0.7, psi)
    );
    colour += phaseColour * (0.08 + density * 0.94);
    colour += phasePalette(phase + 0.12) * ambientDensity * 0.22;
    colour += secondColour * contours * 1.44;
    colour += lineColour * fine * 0.7;
    vec3 rippleColour = phasePalette(
      0.76 + uTime * 0.015 + uPointer.y * 0.12 + mouseDistance * 0.08
    );
    colour += rippleColour * rippleLine * (0.09 + uVelocity * 0.34);

    vec2 cell = floor((p + 10.0) * 33.0);
    vec2 local = fract((p + 10.0) * 33.0) - 0.5;
    float point = smoothstep(0.052, 0.0, length(local)) * step(0.977, hash21(cell));
    colour += phasePalette(hash21(cell) + 0.12) * point * (0.25 + density);

    vec3 aboutBase = vec3(0.004, 0.012, 0.027);
    vec3 aboutCyan = vec3(0.16, 0.69, 0.76);
    vec3 aboutViolet = vec3(0.34, 0.25, 0.55);
    vec3 aboutGold = vec3(0.64, 0.48, 0.21);
    vec3 aboutLine = mix(aboutCyan, aboutViolet, smoothstep(-0.58, 0.42, psi));
    aboutLine = mix(aboutLine, aboutGold, smoothstep(0.47, 0.92, psi));
    vec3 aboutColour = aboutBase;
    aboutColour += aboutLine * contours * 0.54;
    aboutColour += mix(aboutViolet, aboutCyan, density) * fine * 0.2;
    aboutColour += phaseColour * density * 0.07;
    aboutColour += aboutCyan * rippleLine * (0.025 + uVelocity * 0.08);
    aboutColour += vec3(0.05, 0.09, 0.12) * ambientDensity * 0.22;
    colour = mix(colour, aboutColour, uAbout);

    colour *= 1.03;
    colour = colour / (vec3(1.0) + colour * 0.16);
    colour = mix(vec3(dot(colour, vec3(0.299, 0.587, 0.114))), colour, uColour);
    gl_FragColor = vec4(colour, 1.0);
  }
`;

function createField() {
  if (!hasWebGL()) {
    body.classList.add("no-webgl");
    return false;
  }

  try {
    const mobile = window.innerWidth < 760 || coarsePointer.matches;
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1 : 1.6));
    renderer.setSize(window.innerWidth, window.innerHeight, false);

    const scene = new THREE.Scene();
    const camera = new THREE.Camera();
    material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uVelocity: { value: 0 },
        uColour: { value: 1 },
        uAbout: { value: aboutMode ? 1 : 0 },
        uResolution: {
          value: new THREE.Vector2(
            window.innerWidth * renderer.getPixelRatio(),
            window.innerHeight * renderer.getPixelRatio(),
          ),
        },
        uPointer: { value: state.pointer.clone() },
      },
    });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

    const render = (now) => {
      const delta = Math.min((now - lastFrame) / 1000, 0.05);
      lastFrame = now;
      const pointerEase = 1 - Math.pow(0.012, delta);
      state.pointer.lerp(state.target, pointerEase);
      state.velocity += (0 - state.velocity) * 0.055;
      material.uniforms.uPointer.value.copy(state.pointer);
      material.uniforms.uVelocity.value +=
        (state.velocity - material.uniforms.uVelocity.value) * 0.13;
      if (!coarsePointer.matches && cursor.classList.contains("is-visible")) {
        cursor.style.transform =
          `translate(${state.pointer.x * window.innerWidth}px, ` +
          `${(1 - state.pointer.y) * window.innerHeight}px) translate(-50%, -50%)`;
      }
      if (state.live) {
        material.uniforms.uTime.value += delta * (aboutMode ? 0.24 : 1);
      }
      renderer.render(scene, camera);
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
    return true;
  } catch (error) {
    console.warn("Quantum field unavailable; using the CSS fallback.", error);
    body.classList.add("no-webgl");
    return false;
  }
}

function resize() {
  if (!renderer || !material) return;
  const mobile = window.innerWidth < 760 || coarsePointer.matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1 : 1.6));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  material.uniforms.uResolution.value.set(
    window.innerWidth * renderer.getPixelRatio(),
    window.innerHeight * renderer.getPixelRatio(),
  );
}

function updatePointer(event) {
  const nextX = event.clientX / window.innerWidth;
  const nextY = 1 - event.clientY / window.innerHeight;
  const movement = Math.hypot(
    nextX - state.previous.x,
    nextY - state.previous.y,
  );
  state.velocity = Math.min(
    state.velocity + movement * (aboutMode ? 2.4 : 8.5),
    aboutMode ? 0.42 : 1,
  );
  state.target.set(nextX, nextY);
  state.previous.set(nextX, nextY);

  if (!coarsePointer.matches) {
    cursor.classList.add("is-visible");
  }
}

async function playOpeningAnimation() {
  if (reduceMotion.matches) return;

  const anime = await animationLibrary;
  if (!anime) {
    canvas.style.removeProperty("opacity");
    canvas.style.removeProperty("transform");
    titleLines.forEach((line) => {
      line.style.removeProperty("opacity");
      line.style.removeProperty("transform");
    });
    creditWords.forEach((word) => {
      word.style.removeProperty("opacity");
      word.style.removeProperty("transform");
    });
    return;
  }

  const { createTimeline, stagger, cubicBezier } = anime;
  const revealEase = cubicBezier(0.16, 1, 0.3, 1);

  createTimeline()
    .add(
      canvas,
      {
        opacity: 1,
        scale: 1,
        duration: 1450,
        ease: "out(4)",
      },
      0,
    )
    .add(
      [".grain", ".shade"],
      {
        opacity: { from: 0 },
        duration: 950,
        ease: "out(3)",
      },
      120,
    )
    .add(
      titleLines,
      {
        opacity: 1,
        y: 0,
        rotateX: 0,
        skewX: 0,
        scaleX: 1,
        duration: 1120,
        delay: stagger(115),
        ease: revealEase,
      },
      260,
    )
    .add(
      creditWords,
      {
        opacity: 1,
        y: 0,
        duration: 720,
        delay: stagger(55),
        ease: revealEase,
      },
      1280,
    );
}

function finishLoader() {
  const start = performance.now();
  const duration = reduceMotion.matches ? 120 : 1000;
  const tick = (now) => {
    const raw = Math.min((now - start) / duration, 1);
    const progress = Math.round((1 - Math.pow(1 - raw, 3)) * 100);
    loaderBar.style.transform = `translateX(${progress - 100}%)`;
    if (raw < 1) {
      requestAnimationFrame(tick);
      return;
    }
    window.setTimeout(() => {
      playOpeningAnimation();
      loader.classList.add("is-complete");
      body.classList.add("page-ready");
    }, reduceMotion.matches ? 0 : 120);
  };
  requestAnimationFrame(tick);
}

function initializeContentReveals() {
  if (!revealElements.length) return;

  if (reduceMotion.matches || !("IntersectionObserver" in window)) {
    revealElements.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
  );

  revealElements.forEach((element) => observer.observe(element));
}

window.addEventListener("pointermove", updatePointer, { passive: true });
window.addEventListener("resize", resize, { passive: true });

createField();
initializeContentReveals();
finishLoader();
