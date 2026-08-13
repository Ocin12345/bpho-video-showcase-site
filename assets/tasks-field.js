import * as THREE from "../vendor/packages/three/three.module.min.js";

const canvas = document.querySelector("#tasks-quantum-field");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const coarsePointer = window.matchMedia("(pointer: coarse)");
const pointer = new THREE.Vector2(0.68, 0.48);
const target = pointer.clone();
const previous = pointer.clone();
let velocity = 0;
let renderer;
let material;
let lastFrame = performance.now();

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

  vec3 palette(float t) {
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
    vec2 delta = p - mouse;
    float mouseDistance = length(delta);
    float rippleEnvelope = exp(-mouseDistance * mouseDistance * 54.4)
      * smoothstep(0.006, 0.03, mouseDistance);
    float ripplePhase = mouseDistance * 152.0 - uTime * 4.4;
    float movingRipple = sin(ripplePhase) * rippleEnvelope;
    float rippleLine = pow(0.5 + 0.5 * cos(ripplePhase), 18.0) * rippleEnvelope;
    p += normalize(delta + vec2(0.0001)) * movingRipple * (0.009 + uVelocity * 0.022);
    p += mouse * vec2(0.032, -0.018);

    float slow = uTime * 0.28;
    vec2 c1 = vec2(0.52 + sin(slow) * 0.13, 0.28 + cos(slow * 0.8) * 0.10);
    vec2 c2 = vec2(-0.36 + cos(slow * 0.7) * 0.12, -0.05 + sin(slow) * 0.09);
    vec2 c3 = vec2(0.12 + mouse.x * 0.14, -0.50 + mouse.y * 0.08);
    float edge = max(0.68, aspect * 0.78);
    vec2 c4 = vec2(edge + sin(slow * 0.62) * 0.08, 0.02 + cos(slow * 0.74) * 0.13);
    vec2 c5 = vec2(-edge + cos(slow * 0.58) * 0.08, 0.16 + sin(slow * 0.68) * 0.12);

    float ambient = sin(p.x * 2.25 + sin(p.y * 1.15 + uTime * 0.1) * 0.75) * 0.22;
    ambient += cos(p.y * 2.0 - cos(p.x * 1.25 - uTime * 0.1) * 0.68) * 0.14;
    ambient += sin((p.x - p.y) * 1.65 + uTime * 0.05) * 0.09;

    float psi = ambient * 0.72;
    psi += packet(p, c1, 0.58, 12.0, 1.12, 0.0);
    psi += packet(p.yx, c2.yx, 0.74, 10.0, -0.8, 1.6);
    psi += packet(p, c3, 0.39, 15.0, 1.45, 3.2);
    psi += packet(p, c4, 0.66, 11.5, -0.92, 2.3) * 0.72;
    psi += packet(p.yx, c5.yx, 0.68, 12.6, 0.86, 4.2) * 0.72;

    float r1 = length(p - c1);
    float r2 = length(p - c2);
    psi += sin(r1 * 27.0 - uTime * 1.35) * exp(-r1 * 1.8) * 0.42;
    psi += sin(r2 * 22.0 + uTime) * exp(-r2 * 1.45) * 0.38;
    psi += movingRipple * (0.14 + uVelocity * 0.2);

    float density = smoothstep(0.045, 0.9, abs(psi));
    float contourBase = abs(fract(psi * 4.8 + r1 * 1.9) - 0.5) * 2.0;
    float contours = pow(1.0 - contourBase, 9.0);
    float fineBase = abs(fract((psi + r2) * 12.0) - 0.5) * 2.0;
    float fine = pow(1.0 - fineBase, 18.0) * smoothstep(0.03, 0.62, abs(psi));

    float phase = 0.58 + psi * 0.23 + r1 * 0.055 + uPointer.x * 0.1 + uTime * 0.008;
    vec3 colour = vec3(0.008, 0.011, 0.052);
    colour += palette(phase) * (0.08 + density * 0.94);
    colour += palette(phase + 0.46 + r2 * 0.04) * contours * 1.44;
    colour += mix(vec3(0.08, 0.94, 1.0), vec3(0.70, 1.0, 0.24), smoothstep(-0.5, 0.7, psi)) * fine * 0.7;
    colour += palette(0.76 + uTime * 0.015 + mouseDistance * 0.08) * rippleLine * (0.09 + uVelocity * 0.34);

    vec2 cell = floor((p + 10.0) * 33.0);
    vec2 local = fract((p + 10.0) * 33.0) - 0.5;
    float point = smoothstep(0.052, 0.0, length(local)) * step(0.977, hash21(cell));
    colour += palette(hash21(cell) + 0.12) * point * (0.25 + density);
    colour = colour * 1.03 / (vec3(1.0) + colour * 0.16);
    gl_FragColor = vec4(colour, 1.0);
  }
`;

function hasWebGL() {
  try {
    const test = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && (test.getContext("webgl") || test.getContext("experimental-webgl")));
  } catch {
    return false;
  }
}

function resize() {
  const mobile = window.innerWidth < 760 || coarsePointer.matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1 : 1.6));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  material.uniforms.uResolution.value.set(
    window.innerWidth * renderer.getPixelRatio(),
    window.innerHeight * renderer.getPixelRatio(),
  );
}

function createField() {
  if (!canvas || !hasWebGL()) {
    document.body.classList.add("no-webgl");
    return;
  }

  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    const scene = new THREE.Scene();
    const camera = new THREE.Camera();
    material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uVelocity: { value: 0 },
        uResolution: { value: new THREE.Vector2() },
        uPointer: { value: pointer.clone() },
      },
    });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
    resize();

    const render = (now) => {
      const dt = Math.min((now - lastFrame) / 1000, 0.05);
      lastFrame = now;
      previous.copy(pointer);
      pointer.lerp(target, 1.0 - Math.pow(0.001, dt));
      velocity += (pointer.distanceTo(previous) / Math.max(dt, 0.001) - velocity) * 0.08;
      velocity *= 0.92;
      material.uniforms.uPointer.value.copy(pointer);
      material.uniforms.uVelocity.value = Math.min(velocity, 1.0);
      material.uniforms.uTime.value = reduceMotion.matches ? 2.5 : now * 0.001;
      renderer.render(scene, camera);
      if (!reduceMotion.matches) requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
    window.addEventListener("resize", resize);
  } catch {
    document.body.classList.add("no-webgl");
  }
}

window.addEventListener("pointermove", (event) => {
  target.set(event.clientX / window.innerWidth, 1 - event.clientY / window.innerHeight);
}, { passive: true });

createField();
