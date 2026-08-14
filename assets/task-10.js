import * as THREE from "../vendor/packages/three/three.module.min.js";
import {
  angularCombination,
  clamp,
  coefficientNorm,
  complexAbsSquared,
  formatOrbital,
  h2Centres,
  h2MolecularOrbital,
  h3Centres,
  h3MolecularOrbital,
  hydrogenicEnergyEv,
  hydrogenicOrbital,
  mMorphCoefficients,
  morphOrbital,
  neonElectronCount,
  neonElectronDensity,
  normalizeRealCoefficients,
  orbitalNodeCounts,
  overlapMatrix,
  quadraticForm,
  radialWavefunction,
  sphericalHarmonic,
} from "./task-10-model.js";

const TAU = Math.PI * 2;
const SUBSHELLS = ["s", "p", "d", "f", "g"];
const PHASE_BLUE = [23, 105, 176];
const PHASE_RED = [200, 88, 98];
const CORE_GOLD = [174, 133, 54];
const VALENCE_BLUE = [23, 105, 176];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const coarsePointer = window.matchMedia("(pointer: coarse)");

const elements = {
  canvas: document.querySelector("#orbital-canvas"),
  fallback: document.querySelector("#orbital-fallback"),
  viewport: document.querySelector("[data-orbital-viewport]"),
  loading: document.querySelector("[data-stage-loading]"),
  rendererStatus: document.querySelector("[data-renderer-status]"),
  rendererStatusWrap: document.querySelector(".renderer-status"),
  nucleusLabels: document.querySelector("[data-nucleus-labels]"),
  stageTitle: document.querySelector("[data-stage-title]"),
  modelLabel: document.querySelector("[data-model-label]"),
  modelInsight: document.querySelector("[data-model-insight]"),
  modelFormula: document.querySelector("[data-model-formula]"),
  stageHint: document.querySelector("[data-stage-hint]"),
  resetStateButtons: document.querySelectorAll("[data-reset-state]"),
  sceneSymbol: document.querySelector("[data-scene-symbol]"),
  sceneDetail: document.querySelector("[data-scene-detail]"),
  positiveKey: document.querySelector("[data-positive-key]"),
  negativeKey: document.querySelector("[data-negative-key]"),
  n: document.querySelector("[data-n-control]"),
  l: document.querySelector("[data-l-control]"),
  m: document.querySelector("[data-m-control]"),
  phase: document.querySelector("[data-phase-control]"),
  mOutput: document.querySelector("[data-m-output]"),
  phaseOutput: document.querySelector("[data-phase-output]"),
  mMin: document.querySelector("[data-m-min]"),
  mMax: document.querySelector("[data-m-max]"),
  morphPlay: document.querySelector("[data-morph-play]"),
  playIcon: document.querySelector("[data-play-icon]"),
  playLabel: document.querySelector("[data-play-label]"),
  h2Distance: document.querySelector("[data-h2-distance]"),
  h2DistanceOutput: document.querySelector("[data-h2-distance-output]"),
  h2Equation: document.querySelector("[data-h2-equation]"),
  h2Overlap: document.querySelector("[data-h2-overlap]"),
  h3Distance: document.querySelector("[data-h3-distance]"),
  h3DistanceOutput: document.querySelector("[data-h3-distance-output]"),
  h3Normalization: document.querySelector("[data-h3-normalization]"),
  radial: document.querySelector("#radial-canvas"),
  slice: document.querySelector("#slice-canvas"),
  radialKicker: document.querySelector("[data-radial-kicker]"),
  radialTitle: document.querySelector("[data-radial-title]"),
  radialIntegral: document.querySelector("[data-radial-integral]"),
  radialCaption: document.querySelector("[data-radial-caption]"),
  sliceTitle: document.querySelector("[data-slice-title]"),
  sliceScale: document.querySelector("[data-slice-scale]"),
  sliceCaption: document.querySelector("[data-slice-caption]"),
  structureSummary: document.querySelector("[data-structure-summary]"),
  validationSummary: document.querySelector("[data-validation-summary]"),
};

const ledger = Array.from({ length: 4 }, (_, index) => ({
  label: document.querySelector(`[data-ledger-label-${index + 1}]`),
  value: document.querySelector(`[data-ledger-value-${index + 1}]`),
}));

const state = {
  model: "morph",
  n: 3,
  l: 2,
  mPath: -2,
  relativePhase: 0,
  neonComponent: "total",
  h2Parity: 1,
  h2Distance: 1.4,
  h3Distance: 1.65,
  playing: false,
  playDirection: 1,
  yaw: -0.52,
  pitch: 0.34,
  zoom: 9,
  renderToken: 0,
  sceneScale: 1,
  sceneCentres: [],
  pointCount: 0,
};

const DEFAULT_LAB_STATE = Object.freeze({
  model: "morph",
  n: 3,
  l: 2,
  mPath: -2,
  relativePhase: 0,
  neonComponent: "total",
  h2Parity: 1,
  h2Distance: 1.4,
  h3Distance: 1.65,
  playing: false,
  playDirection: 1,
  yaw: -0.52,
  pitch: 0.34,
  zoom: 9,
});

let scene;
let camera;
let renderer;
let orbitalGroup;
let points;
let pointMaterial;
let nucleusGroup;
let resizeObserver;
let graphTimer = 0;
let sceneTimer = 0;
let animationFrame = 0;
let lastAnimationTime = 0;
let lastMorphSceneTime = 0;
let lastMorphGraphTime = 0;
let pointerDrag = null;
let webglAvailable = false;
let cachedNeonSpatialCount;

const GAUSS_LEGENDRE_12 = Object.freeze([
  [-0.9815606342467192, 0.0471753363865118],
  [-0.9041172563704749, 0.1069393259953184],
  [-0.7699026741943047, 0.1600783285433462],
  [-0.5873179542866175, 0.2031674267230659],
  [-0.3678314989981802, 0.2334925365383548],
  [-0.1252334085114689, 0.2491470458134028],
  [0.1252334085114689, 0.2491470458134028],
  [0.3678314989981802, 0.2334925365383548],
  [0.5873179542866175, 0.2031674267230659],
  [0.7699026741943047, 0.1600783285433462],
  [0.9041172563704749, 0.1069393259953184],
  [0.9815606342467192, 0.0471753363865118],
]);

function signed(value, digits = 2) {
  if (Math.abs(value) < 0.5 * 10 ** -digits) return (0).toFixed(digits);
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(digits)}`;
}

function minus(value, digits = 3) {
  return value < 0 ? `−${Math.abs(value).toFixed(digits)}` : value.toFixed(digits);
}

function orbitalName(n = state.n, l = state.l) {
  return `${n}${SUBSHELLS[l] ?? `l${l}`}`;
}

function integerM(value = state.mPath) {
  return Math.abs(value - Math.round(value)) < 0.002;
}

function describeCoefficients(coefficients) {
  return coefficients.map((coefficient) => {
    const magnitude = Math.hypot(coefficient.re, coefficient.im);
    const phase = Math.atan2(coefficient.im, coefficient.re);
    if (magnitude > 0.9995) return `m = ${coefficient.m > 0 ? "+" : ""}${coefficient.m}`;
    const phaseText = Math.abs(phase) < 0.01 ? "" : `∠${Math.round((phase * 180) / Math.PI)}°`;
    return `${magnitude.toFixed(3)}${phaseText}|${coefficient.m}⟩`;
  }).join(" + ");
}

function setLedger(entries) {
  entries.forEach((entry, index) => {
    ledger[index].label.textContent = entry[0];
    ledger[index].value.textContent = entry[1];
    ledger[index].value.title = entry[1];
  });
}

function updateLChoices() {
  const current = clamp(state.l, 0, state.n - 1);
  elements.l.replaceChildren(...Array.from({ length: state.n }, (_, l) => {
    const option = document.createElement("option");
    option.value = String(l);
    option.textContent = `${l} · ${SUBSHELLS[l]}`;
    option.selected = l === current;
    return option;
  }));
  state.l = current;
}

function updateMorphRange(reset = false) {
  elements.m.min = String(-state.l);
  elements.m.max = String(state.l);
  if (reset) state.mPath = -state.l;
  state.mPath = clamp(state.mPath, -state.l, state.l);
  elements.m.value = String(state.mPath);
  elements.mMin.textContent = `m = ${state.l ? `−${state.l}` : "0"}`;
  elements.mMax.textContent = `m = ${state.l ? `+${state.l}` : "0"}`;
  elements.m.disabled = state.l === 0;
  elements.phase.disabled = state.l === 0;
}

function setPressed(selector, predicate) {
  document.querySelectorAll(selector).forEach((button) => {
    button.setAttribute("aria-pressed", String(predicate(button)));
  });
}

function updateControlsAndText() {
  elements.n.value = String(state.n);
  elements.l.value = String(state.l);
  elements.m.value = String(state.mPath);
  elements.phase.value = String(Math.round((state.relativePhase * 180) / Math.PI));
  elements.mOutput.textContent = signed(state.mPath);
  elements.phaseOutput.textContent = `${Math.round((state.relativePhase * 180) / Math.PI)}°`;
  elements.h2Distance.value = String(state.h2Distance);
  elements.h2DistanceOutput.textContent = `${state.h2Distance.toFixed(2)} a₀`;
  elements.h3Distance.value = String(state.h3Distance);
  elements.h3DistanceOutput.textContent = `${state.h3Distance.toFixed(2)} a₀`;
  elements.morphPlay.setAttribute("aria-pressed", String(state.playing));
  elements.playIcon.textContent = state.playing ? "Ⅱ" : "▶";
  elements.playLabel.textContent = state.playing ? "Pause m path" : "Animate m path";

  setPressed("[data-model]", (button) => button.dataset.model === state.model);
  setPressed("[data-orbital-preset]", (button) => button.dataset.orbitalPreset === `${state.n},${state.l}`);
  setPressed("[data-neon-component]", (button) => button.dataset.neonComponent === state.neonComponent);
  setPressed("[data-h2-parity]", (button) => Number(button.dataset.h2Parity) === state.h2Parity);

  document.querySelectorAll("[data-control-set]").forEach((controlSet) => {
    controlSet.hidden = controlSet.dataset.controlSet !== state.model;
  });

  if (state.model === "morph") {
    const coefficients = mMorphCoefficients(state.l, state.mPath, state.relativePhase);
    const nodes = orbitalNodeCounts(state.n, state.l);
    elements.stageTitle.textContent = `${orbitalName()} magnetic-state morph`;
    elements.sceneSymbol.innerHTML = `ψ<sub>${state.n},${state.l}</sub>`;
    elements.sceneDetail.textContent = integerM() ? `magnetic eigenstate m = ${Math.round(state.mPath)}` : `coherent path m = ${signed(state.mPath)}`;
    elements.positiveKey.textContent = "phase 0";
    elements.negativeKey.textContent = "phase π";
    elements.modelLabel.textContent = "m morph";
    elements.modelInsight.innerHTML = "Change <i>m</i> to change the angular pattern; the radial envelope stays fixed within a subshell.";
    elements.modelFormula.innerHTML = "ψ = R<sub>nℓ</sub>(r)Y<sub>ℓm</sub>(θ,φ)";
    elements.stageHint.textContent = "Drag to rotate · arrow keys rotate · no scroll capture";
    setLedger([
      ["State", integerM() ? formatOrbital(state.n, state.l, Math.round(state.mPath)) : describeCoefficients(coefficients)],
      ["Coefficient norm", coefficientNorm(coefficients).toFixed(6)],
      ["Nodes", `${nodes.radial} radial · ${nodes.angular} angular`],
      ["Hydrogen energy", `${minus(hydrogenicEnergyEv(state.n))} eV`],
    ]);
    elements.structureSummary.innerHTML = `The <i>m</i> sweep changes only Y<sub>ℓm</sub>; every state in ${orbitalName()} shares the same normalized R<sub>${state.n}${state.l}</sub>.`;
  } else if (state.model === "neon") {
    const count = state.neonComponent === "total" ? 10 : state.neonComponent === "core" ? 2 : 8;
    elements.stageTitle.textContent = "Neon independent-orbital density";
    elements.sceneSymbol.innerHTML = "ρ<sub>Ne</sub>";
    elements.sceneDetail.textContent = `${state.neonComponent} density · ${count} electrons`;
    elements.positiveKey.textContent = "1s core";
    elements.negativeKey.textContent = "n = 2 shell";
    elements.modelLabel.textContent = "Ne density";
    elements.modelInsight.innerHTML = "Here we add occupied <i>probabilities</i>, not amplitudes: the closed shell becomes spherical.";
    elements.modelFormula.innerHTML = "ρ<sub>Ne</sub>(r) ≈ Σ N<sub>i</sub>|ψ<sub>i</sub>|²";
    elements.stageHint.textContent = "Drag to rotate · labels mark centres · density is not a wavefunction";
    setLedger([
      ["Configuration", "1s² 2s² 2p⁶"],
      ["Electrons shown", count.toFixed(0)],
      ["Core Z_eff", "9.70"],
      ["n = 2 Z_eff", "5.85"],
    ]);
    elements.structureSummary.innerHTML = "Closed-shell occupations make this approximate Ne density spherical. The radial plot separates compact core and screened valence scales.";
  } else if (state.model === "h2") {
    const result = h2MolecularOrbital(0, 0, 0, state.h2Distance, state.h2Parity);
    const bonding = state.h2Parity > 0;
    elements.stageTitle.textContent = `H₂ ${bonding ? "bonding" : "antibonding"} molecular orbital`;
    elements.sceneSymbol.innerHTML = bonding ? "σ<sub>g</sub>²" : "σ<sub>u</sub>*";
    elements.sceneDetail.textContent = `R = ${state.h2Distance.toFixed(2)} a₀ · two-centre LCAO`;
    elements.positiveKey.textContent = "positive amplitude";
    elements.negativeKey.textContent = "negative amplitude";
    elements.modelLabel.textContent = bonding ? "H₂ · bonding" : "H₂ · antibonding";
    elements.modelInsight.innerHTML = bonding
      ? "Same-sign 1s amplitudes reinforce between the nuclei, increasing bond-axis density."
      : "Opposite-sign 1s amplitudes cancel at the midpoint, creating a nodal plane.";
    elements.modelFormula.innerHTML = bonding
      ? "ψ<sub>g</sub> ∝ 1s<sub>A</sub> + 1s<sub>B</sub>"
      : "ψ<sub>u</sub> ∝ 1s<sub>A</sub> − 1s<sub>B</sub>";
    elements.stageHint.textContent = "Drag to rotate · H labels show the two centres · adjust R";
    elements.h2Equation.innerHTML = bonding
      ? "ψ<sub>g</sub> = (1s<sub>A</sub> + 1s<sub>B</sub>)/√[2(1 + S)]"
      : "ψ<sub>u</sub> = (1s<sub>A</sub> − 1s<sub>B</sub>)/√[2(1 − S)]";
    elements.h2Overlap.textContent = `1s overlap S = ${result.overlap.toFixed(4)} · denominator = ${result.normalizationDenominator.toFixed(4)}`;
    setLedger([
      ["Orbital", bonding ? "σg · bonding" : "σu* · antibonding"],
      ["Electrons plotted", bonding ? "2" : "orbital only"],
      ["1s overlap, S", result.overlap.toFixed(6)],
      ["Norm denominator", result.normalizationDenominator.toFixed(6)],
    ]);
    elements.structureSummary.innerHTML = "The axis profile exposes constructive density between the nuclei for σ<sub>g</sub>, or the nodal plane of σ<sub>u</sub>* when the relative sign is reversed.";
  } else {
    const result = h3MolecularOrbital(0, 0, 0, state.h3Distance);
    const normalization = result.coefficients[0];
    elements.stageTitle.textContent = "H₃⁺ three-centre molecular orbital";
    elements.sceneSymbol.innerHTML = "1a′<sub>1</sub>²";
    elements.sceneDetail.textContent = `equilateral R = ${state.h3Distance.toFixed(2)} a₀`;
    elements.positiveKey.textContent = "positive amplitude";
    elements.negativeKey.textContent = "negative amplitude";
    elements.modelLabel.textContent = "H₃⁺ · symmetric MO";
    elements.modelInsight.innerHTML = "Three 1s amplitudes share one phase; the overlap matrix keeps this non-orthogonal basis normalized.";
    elements.modelFormula.innerHTML = "ψ = N(1s<sub>A</sub> + 1s<sub>B</sub> + 1s<sub>C</sub>)";
    elements.stageHint.textContent = "Drag to rotate · H labels show the triangle · adjust side R";
    elements.h3Normalization.textContent = `Overlap-matrix normalization N = ${normalization.toFixed(4)} · pair overlap S = ${result.overlap[0][1].toFixed(4)}`;
    setLedger([
      ["Geometry", "equilateral H₃⁺"],
      ["Electrons plotted", "2"],
      ["Pair overlap, S", result.overlap[0][1].toFixed(6)],
      ["Coefficient, N", normalization.toFixed(6)],
    ]);
    elements.structureSummary.innerHTML = "The lowest symmetric H₃⁺ orbital spreads one amplitude over three 1s centres; cᵀSc = 1 keeps the non-orthogonal basis normalized.";
  }
}

function modelSettings() {
  if (state.model === "morph") {
    const scale = Math.max(0.55, (state.n * state.n) / 3.1);
    return {
      proposalScale: scale,
      centres: [{ x: 0, y: 0, z: 0, label: "Z = 1" }],
      evaluator: (x, y, z) => {
        const psi = morphOrbital(state.n, state.l, state.mPath, state.relativePhase, x, y, z);
        return { density: complexAbsSquared(psi), phase: Math.atan2(psi.im, psi.re) };
      },
    };
  }
  if (state.model === "neon") {
    return {
      proposalScale: 0.26,
      centres: [{ x: 0, y: 0, z: 0, label: "Ne" }],
      evaluator: (x, y, z) => {
        const density = neonElectronDensity(x, y, z);
        const selected = state.neonComponent === "total" ? density.density : density[state.neonComponent];
        return {
          density: selected,
          mixture: selected > 0 ? density.core / density.density : 0,
          phase: 0,
        };
      },
    };
  }
  if (state.model === "h2") {
    const centres = h2Centres(state.h2Distance);
    const reference = h2MolecularOrbital(0, 0, 0, state.h2Distance, state.h2Parity);
    const sign = state.h2Parity > 0 ? 1 : -1;
    const normalization = 1 / Math.sqrt(reference.normalizationDenominator);
    return {
      proposalScale: 0.72,
      centres,
      evaluator: (x, y, z) => {
        const left = hydrogenicOrbital(1, 0, 0, x, y, z, 1, centres[0]).re;
        const right = hydrogenicOrbital(1, 0, 0, x, y, z, 1, centres[1]).re;
        const psi = normalization * (left + sign * right);
        return { density: (state.h2Parity > 0 ? 2 : 1) * psi * psi, phase: psi < 0 ? Math.PI : 0 };
      },
    };
  }
  const centres = h3Centres(state.h3Distance);
  const matrix = overlapMatrix(centres);
  const normalized = normalizeRealCoefficients([1, 1, 1], matrix);
  return {
    proposalScale: 0.76,
    centres,
    evaluator: (x, y, z) => {
      let psi = 0;
      centres.forEach((centre, index) => {
        psi += normalized.coefficients[index] * hydrogenicOrbital(1, 0, 0, x, y, z, 1, centre).re;
      });
      return { density: 2 * psi * psi, phase: psi < 0 ? Math.PI : 0 };
    },
  };
}

function seedFromState() {
  const modelCode = { morph: 11, neon: 29, h2: 47, h3: 71 }[state.model];
  return (
    0x9e3779b9 ^ modelCode * 100003 ^ state.n * 1009 ^ state.l * 9176 ^
    Math.round(state.mPath * 100) * 37 ^ Math.round(state.relativePhase * 100) * 13 ^
    Math.round(state.h2Distance * 100) * 53 ^ Math.round(state.h3Distance * 100) * 67 ^
    (state.h2Parity > 0 ? 1 : 0) ^ state.neonComponent.length * 79
  ) >>> 0;
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function phaseColour(phase) {
  const cosine = 0.5 * (1 + Math.cos(phase));
  const sineLift = Math.sin(phase);
  const base = PHASE_RED.map((red, index) => red + cosine * (PHASE_BLUE[index] - red));
  base[1] += 24 * Math.abs(sineLift);
  base[2] += 18 * Math.max(0, sineLift);
  return base.map((value) => clamp(value, 0, 255));
}

function blendColour(left, right, amount) {
  return left.map((value, index) => value + amount * (right[index] - value));
}

function proposalDensity(x, y, z, centres, scale) {
  const denominator = centres.length * 8 * Math.PI * scale ** 3;
  let sum = 0;
  for (const centre of centres) {
    sum += Math.exp(-Math.hypot(x - centre.x, y - centre.y, z - centre.z) / scale);
  }
  return sum / denominator;
}

function generateDensitySample(settings, token) {
  const mobile = coarsePointer.matches || window.innerWidth < 760;
  const candidateCount = mobile ? 26000 : 48000;
  const targetCount = mobile ? 5200 : 9200;
  const random = mulberry32(seedFromState());
  const candidates = [];
  let totalWeight = 0;

  for (let index = 0; index < candidateCount; index += 1) {
    const centre = settings.centres[Math.floor(random() * settings.centres.length)];
    const radius = -settings.proposalScale * Math.log(Math.max(1e-15, random() * random() * random()));
    const cosTheta = 2 * random() - 1;
    const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
    const phi = TAU * random();
    const x = centre.x + radius * sinTheta * Math.cos(phi);
    const y = centre.y + radius * sinTheta * Math.sin(phi);
    const z = centre.z + radius * cosTheta;
    const result = settings.evaluator(x, y, z);
    const proposal = proposalDensity(x, y, z, settings.centres, settings.proposalScale);
    const weight = Number.isFinite(result.density) && result.density > 0 ? result.density / proposal : 0;
    if (weight > 0 && Number.isFinite(weight)) {
      totalWeight += weight;
      candidates.push({ x, y, z, result, cumulative: totalWeight });
    }
  }

  if (token !== state.renderToken || candidates.length === 0 || !(totalWeight > 0)) return null;
  const samples = [];
  const step = totalWeight / targetCount;
  let threshold = random() * step;
  let candidateIndex = 0;
  for (let index = 0; index < targetCount; index += 1) {
    while (candidateIndex < candidates.length - 1 && candidates[candidateIndex].cumulative < threshold) candidateIndex += 1;
    const candidate = candidates[candidateIndex];
    const jitter = settings.proposalScale * 0.012;
    const x = candidate.x + (random() - 0.5) * jitter;
    const y = candidate.y + (random() - 0.5) * jitter;
    const z = candidate.z + (random() - 0.5) * jitter;
    samples.push({ x, y, z, result: settings.evaluator(x, y, z) });
    threshold += step;
  }
  return samples;
}

function quantile(values, fraction) {
  if (!values.length) return 1;
  values.sort((left, right) => left - right);
  return values[Math.min(values.length - 1, Math.max(0, Math.floor(fraction * (values.length - 1))))];
}

function disposePoints() {
  if (!points) return;
  orbitalGroup.remove(points);
  points.geometry.dispose();
  points = null;
}

function disposeNuclei() {
  if (!nucleusGroup) return;
  orbitalGroup.remove(nucleusGroup);
  nucleusGroup.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
    if (object.material) object.material.dispose();
  });
  nucleusGroup = null;
  elements.nucleusLabels.replaceChildren();
}

function updatePointScene(samples, settings) {
  if (!webglAvailable || !orbitalGroup) return;
  disposePoints();
  disposeNuclei();

  const centroid = settings.centres.reduce((sum, centre) => ({
    x: sum.x + centre.x / settings.centres.length,
    y: sum.y + centre.y / settings.centres.length,
    z: sum.z + centre.z / settings.centres.length,
  }), { x: 0, y: 0, z: 0 });
  const radii = samples.map((sample) => Math.hypot(sample.x - centroid.x, sample.y - centroid.y, sample.z - centroid.z));
  const extent = Math.max(0.3, quantile(radii, 0.988));
  state.sceneScale = 3.75 / extent;
  state.sceneCentres = settings.centres.map((centre) => ({
    ...centre,
    scene: new THREE.Vector3(
      (centre.x - centroid.x) * state.sceneScale,
      (centre.y - centroid.y) * state.sceneScale,
      (centre.z - centroid.z) * state.sceneScale,
    ),
  }));

  const positionArray = new Float32Array(samples.length * 3);
  const colourArray = new Float32Array(samples.length * 3);
  const sizeArray = new Float32Array(samples.length);
  const opacityArray = new Float32Array(samples.length);

  samples.forEach((sample, index) => {
    positionArray[index * 3] = (sample.x - centroid.x) * state.sceneScale;
    positionArray[index * 3 + 1] = (sample.y - centroid.y) * state.sceneScale;
    positionArray[index * 3 + 2] = (sample.z - centroid.z) * state.sceneScale;
    let colour;
    if (state.model === "neon") {
      const coreFraction = state.neonComponent === "core" ? 1 : state.neonComponent === "valence" ? 0 : clamp(sample.result.mixture ?? 0, 0, 1);
      colour = blendColour(VALENCE_BLUE, CORE_GOLD, coreFraction);
    } else {
      colour = phaseColour(sample.result.phase ?? 0);
    }
    colourArray[index * 3] = colour[0] / 255;
    colourArray[index * 3 + 1] = colour[1] / 255;
    colourArray[index * 3 + 2] = colour[2] / 255;
    sizeArray[index] = mobilePointSize();
    opacityArray[index] = 0.56;
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positionArray, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colourArray, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizeArray, 1));
  geometry.setAttribute("aOpacity", new THREE.BufferAttribute(opacityArray, 1));
  geometry.computeBoundingSphere();
  points = new THREE.Points(geometry, pointMaterial);
  points.frustumCulled = false;
  orbitalGroup.add(points);

  nucleusGroup = new THREE.Group();
  for (const centre of state.sceneCentres) {
    const geometrySphere = new THREE.SphereGeometry(state.model === "neon" ? 0.09 : 0.075, 18, 12);
    const materialSphere = new THREE.MeshBasicMaterial({ color: 0xf4eee0 });
    const sphere = new THREE.Mesh(geometrySphere, materialSphere);
    sphere.position.copy(centre.scene);
    nucleusGroup.add(sphere);
    const label = document.createElement("span");
    label.className = "nucleus-label";
    label.textContent = centre.label;
    elements.nucleusLabels.append(label);
    centre.element = label;
  }
  orbitalGroup.add(nucleusGroup);
  state.pointCount = samples.length;
  renderThree();
}

function mobilePointSize() {
  return window.innerWidth < 760 ? 4.2 : 3.5;
}

function initThree() {
  let context;
  try {
    context = elements.canvas.getContext("webgl2", {
      alpha: false,
      antialias: true,
      depth: true,
      powerPreference: "high-performance",
    });
  } catch {
    context = null;
  }
  if (!context) {
    activateFallback("WebGL unavailable · 2D projection active");
    return;
  }

  try {
    renderer = new THREE.WebGLRenderer({ canvas: elements.canvas, context, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 760 ? 1.2 : 1.7));
    renderer.setClearColor(0xfbfaf7, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0, state.zoom);
    orbitalGroup = new THREE.Group();
    scene.add(orbitalGroup);

    pointMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      vertexColors: true,
      uniforms: { pixelRatio: { value: renderer.getPixelRatio() } },
      vertexShader: `
        attribute float aSize;
        attribute float aOpacity;
        varying vec3 vColor;
        varying float vOpacity;
        uniform float pixelRatio;
        void main() {
          vColor = color;
          vOpacity = aOpacity;
          vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(aSize * pixelRatio * (8.5 / max(1.0, -viewPosition.z)), 1.2, 8.5);
          gl_Position = projectionMatrix * viewPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vOpacity;
        void main() {
          vec2 centred = gl_PointCoord - vec2(0.5);
          float radius = length(centred);
          if (radius > 0.5) discard;
          float edge = smoothstep(0.5, 0.16, radius);
          gl_FragColor = vec4(vColor, vOpacity * edge);
        }
      `,
    });
    webglAvailable = true;
    elements.rendererStatus.textContent = "Local WebGL · weighted density sample";
    elements.rendererStatusWrap.dataset.state = "ready";
    resizeThree();
  } catch (error) {
    console.warn("Task 10 WebGL initialization failed; using 2D fallback.", error);
    activateFallback("WebGL failed · 2D projection active");
  }
}

function activateFallback(message) {
  webglAvailable = false;
  elements.canvas.hidden = true;
  elements.fallback.hidden = false;
  elements.rendererStatus.textContent = message;
  elements.rendererStatusWrap.dataset.state = "fallback";
  elements.loading.classList.add("is-ready");
}

function resizeThree() {
  if (!renderer || !camera) return;
  const width = Math.max(1, elements.viewport.clientWidth);
  const height = Math.max(1, elements.viewport.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 760 ? 1.2 : 1.7));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  if (pointMaterial) pointMaterial.uniforms.pixelRatio.value = renderer.getPixelRatio();
  renderThree();
}

function projectNucleusLabels() {
  if (!camera || !orbitalGroup) return;
  const width = elements.viewport.clientWidth;
  const height = elements.viewport.clientHeight;
  state.sceneCentres.forEach((centre) => {
    if (!centre.element) return;
    const projected = centre.scene.clone().applyMatrix4(orbitalGroup.matrixWorld).project(camera);
    centre.element.style.left = `${(projected.x * 0.5 + 0.5) * width}px`;
    centre.element.style.top = `${(-projected.y * 0.5 + 0.5) * height}px`;
    centre.element.hidden = projected.z < -1 || projected.z > 1;
  });
}

function renderThree() {
  if (!webglAvailable || !renderer || !scene || !camera || !orbitalGroup) return;
  orbitalGroup.rotation.set(state.pitch, state.yaw, 0);
  camera.position.z = state.zoom;
  camera.updateMatrixWorld();
  orbitalGroup.updateMatrixWorld(true);
  renderer.render(scene, camera);
  projectNucleusLabels();
}

function resizeCanvas(canvas, maximumDensity = 2) {
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  const density = Math.min(window.devicePixelRatio || 1, maximumDensity);
  const pixelWidth = Math.round(width * density);
  const pixelHeight = Math.round(height * density);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const context = canvas.getContext("2d");
  context.setTransform(density, 0, 0, density, 0, 0);
  return { context, width, height, density };
}

function drawFallbackProjection() {
  const { context, width, height } = resizeCanvas(elements.fallback, 1.5);
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#fbfaf7";
  context.fillRect(0, 0, width, height);
  const settings = modelSettings();
  const extent = modelPlotExtent();
  const resolution = Math.min(180, Math.max(90, Math.round(Math.min(width, height) / 3)));
  const cellWidth = width / resolution;
  const cellHeight = height / resolution;
  const values = [];
  let maximum = 0;
  for (let row = 0; row < resolution; row += 1) {
    for (let column = 0; column < resolution; column += 1) {
      const x = ((column + 0.5) / resolution * 2 - 1) * extent;
      const z = (1 - (row + 0.5) / resolution * 2) * extent;
      const value = settings.evaluator(x, 0, z);
      maximum = Math.max(maximum, value.density);
      values.push(value);
    }
  }
  values.forEach((value, index) => {
    const column = index % resolution;
    const row = Math.floor(index / resolution);
    const brightness = Math.pow(clamp(value.density / Math.max(1e-30, maximum), 0, 1), 0.24);
    let colour = state.model === "neon"
      ? blendColour(VALENCE_BLUE, CORE_GOLD, state.neonComponent === "core" ? 1 : state.neonComponent === "valence" ? 0 : clamp(value.mixture ?? 0, 0, 1))
      : phaseColour(value.phase ?? 0);
    colour = colour.map((channel) => channel * brightness);
    context.fillStyle = `rgb(${colour[0]},${colour[1]},${colour[2]})`;
    context.fillRect(column * cellWidth, row * cellHeight, cellWidth + 0.5, cellHeight + 0.5);
  });
  context.fillStyle = "rgba(255,255,255,.82)";
  for (const centre of settings.centres) {
    const x = width / 2 + (centre.x / extent) * width / 2;
    const y = height / 2 - (centre.z / extent) * height / 2;
    context.beginPath();
    context.arc(x, y, 4, 0, TAU);
    context.fill();
  }
}

function modelPlotExtent() {
  if (state.model === "morph") return Math.max(4, state.n * state.n * 2.15);
  if (state.model === "neon") return state.neonComponent === "core" ? 1.2 : 3.2;
  if (state.model === "h2") return Math.max(4, state.h2Distance / 2 + 3.2);
  return Math.max(4, state.h3Distance / Math.sqrt(3) + 3.2);
}

function scheduleSceneRebuild(delay = 55) {
  window.clearTimeout(sceneTimer);
  const token = ++state.renderToken;
  elements.loading.classList.remove("is-ready");
  sceneTimer = window.setTimeout(() => {
    const settings = modelSettings();
    if (webglAvailable) {
      const samples = generateDensitySample(settings, token);
      if (samples && token === state.renderToken) updatePointScene(samples, settings);
    } else {
      drawFallbackProjection();
    }
    if (token === state.renderToken) {
      elements.loading.classList.add("is-ready");
      const description = stageAriaDescription();
      elements.canvas.setAttribute("aria-label", description);
      elements.fallback.setAttribute("aria-label", `${description} Two-dimensional fallback projection.`);
    }
  }, delay);
}

function stageAriaDescription() {
  if (state.model === "morph") return `Interactive three-dimensional probability-density sample for ${orbitalName()}, at m path ${signed(state.mPath)} and relative phase ${Math.round(state.relativePhase * 180 / Math.PI)} degrees. Drag to rotate or use arrow keys.`;
  if (state.model === "neon") return `Interactive three-dimensional ${state.neonComponent} electron-density sample for an effective-charge neon configuration with ${state.neonComponent === "total" ? 10 : state.neonComponent === "core" ? 2 : 8} electrons.`;
  if (state.model === "h2") return `Interactive three-dimensional ${state.h2Parity > 0 ? "bonding" : "antibonding"} H2 molecular orbital at separation ${state.h2Distance.toFixed(2)} Bohr radii.`;
  return `Interactive three-dimensional lowest symmetric H3 plus molecular orbital on an equilateral triangle of side ${state.h3Distance.toFixed(2)} Bohr radii.`;
}

function simpsonIntegrate(fn, start, end, intervals = 4000) {
  const evenIntervals = intervals % 2 === 0 ? intervals : intervals + 1;
  const step = (end - start) / evenIntervals;
  let sum = fn(start) + fn(end);
  for (let index = 1; index < evenIntervals; index += 1) {
    sum += (index % 2 === 0 ? 2 : 4) * fn(start + index * step);
  }
  return (sum * step) / 3;
}

function radialData() {
  if (state.model === "morph") {
    const maxR = Math.max(18, state.n * state.n * 4.5);
    const pointsData = Array.from({ length: 720 }, (_, index) => {
      const r = (index / 719) * maxR;
      const radial = radialWavefunction(state.n, state.l, r);
      return { x: r, y: r * r * radial * radial };
    });
    const integral = simpsonIntegrate((r) => {
      const radial = radialWavefunction(state.n, state.l, r);
      return r * r * radial * radial;
    }, 0, maxR, 8000);
    const nodes = orbitalNodeCounts(state.n, state.l).radial;
    return {
      data: pointsData,
      xMax: maxR,
      integral,
      target: 1,
      title: `P${orbitalName()}(r) = r²|R${state.n}${state.l}|²`,
      kicker: "Hydrogenic radial probability",
      caption: `Area under the curve is ${integral.toFixed(5)} on the displayed domain. ${orbitalName()} has ${nodes || "no"} radial node${nodes === 1 ? "" : "s"}.`,
      integralText: `∫P dr = ${integral.toFixed(5)}`,
      xLabel: "r / a₀",
    };
  }

  if (state.model === "neon") {
    const count = state.neonComponent === "total" ? 10 : state.neonComponent === "core" ? 2 : 8;
    const maxR = state.neonComponent === "core" ? 1.6 : 4;
    const componentAt = (r) => {
      const density = neonElectronDensity(r, 0, 0);
      return state.neonComponent === "total" ? density.density : density[state.neonComponent];
    };
    const pointsData = Array.from({ length: 720 }, (_, index) => {
      const r = (index / 719) * maxR;
      return { x: r, y: 4 * Math.PI * r * r * componentAt(r) };
    });
    const integral = simpsonIntegrate((r) => 4 * Math.PI * r * r * componentAt(r), 0, maxR, 8000);
    return {
      data: pointsData,
      xMax: maxR,
      integral,
      target: count,
      title: `4πr²ρ${state.neonComponent === "total" ? "Ne" : state.neonComponent}(r)`,
      kicker: "Effective-charge radial electron count",
      caption: `The displayed radial domain contains ${integral.toFixed(4)} of ${count} electrons. Filled 2p magnetic substates sum to a spherical shell.`,
      integralText: `∫4πr²ρ dr = ${integral.toFixed(4)} e⁻`,
      xLabel: "r / a₀",
    };
  }

  const extent = modelPlotExtent();
  const settings = modelSettings();
  const pointsData = Array.from({ length: 720 }, (_, index) => {
    const x = -extent + (index / 719) * 2 * extent;
    return { x, y: settings.evaluator(x, 0, 0).density };
  });
  return {
    data: pointsData,
    xMin: -extent,
    xMax: extent,
    integral: null,
    target: null,
    title: state.model === "h2" ? "ρ(x, 0, 0) along the bond axis" : "ρ(x, 0, 0) through two H centres",
    kicker: "Molecular-orbital density profile",
    caption: state.model === "h2"
      ? `${state.h2Parity > 0 ? "Constructive interference raises density between the nuclei." : "Destructive interference forces ρ = 0 at the midpoint."} This line profile is not a volume integral.`
      : "This line crosses the two lower H centres of the equilateral triangle. The third centre lies above the section; this is not a volume integral.",
    integralText: "axis profile · arbitrary density scale",
    xLabel: "x / a₀",
    centres: settings.centres.map((centre) => centre.x),
  };
}

function drawRadialGraph() {
  const { context, width, height } = resizeCanvas(elements.radial);
  const result = radialData();
  elements.radialKicker.textContent = result.kicker;
  elements.radialTitle.textContent = result.title;
  elements.radialIntegral.textContent = result.integralText;
  elements.radialCaption.textContent = result.caption;
  const margin = { top: 22, right: 22, bottom: 47, left: width < 500 ? 48 : 62 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const xMin = result.xMin ?? 0;
  const xMax = result.xMax;
  const yMax = Math.max(...result.data.map((point) => point.y), 1e-12) * 1.1;
  const xFor = (x) => margin.left + ((x - xMin) / (xMax - xMin)) * plotWidth;
  const yFor = (y) => margin.top + (1 - y / yMax) * plotHeight;

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  context.font = "10px Times New Roman, serif";
  context.fillStyle = "#6b6860";
  context.strokeStyle = "#e3dfd7";
  context.lineWidth = 1;
  context.textAlign = "right";
  for (let index = 0; index <= 4; index += 1) {
    const fraction = index / 4;
    const y = yFor(fraction * yMax);
    context.beginPath(); context.moveTo(margin.left, y); context.lineTo(width - margin.right, y); context.stroke();
    context.fillText((fraction * yMax).toPrecision(2), margin.left - 8, y + 3);
  }
  context.textAlign = "center";
  for (let index = 0; index <= 4; index += 1) {
    const xValue = xMin + (index / 4) * (xMax - xMin);
    const x = xFor(xValue);
    context.beginPath(); context.moveTo(x, margin.top); context.lineTo(x, height - margin.bottom); context.stroke();
    context.fillText(Math.abs(xValue) >= 10 ? xValue.toFixed(0) : xValue.toFixed(1), x, height - margin.bottom + 19);
  }
  context.fillText(result.xLabel, margin.left + plotWidth / 2, height - 10);

  if (result.centres) {
    context.save();
    context.setLineDash([4, 4]);
    context.strokeStyle = "#bd624d";
    result.centres.forEach((centre) => {
      const x = xFor(centre);
      context.beginPath(); context.moveTo(x, margin.top); context.lineTo(x, height - margin.bottom); context.stroke();
    });
    context.restore();
  }

  const gradient = context.createLinearGradient(0, margin.top, 0, height - margin.bottom);
  gradient.addColorStop(0, "rgba(40,107,140,.34)");
  gradient.addColorStop(1, "rgba(40,107,140,.025)");
  context.beginPath();
  result.data.forEach((point, index) => {
    const x = xFor(point.x);
    const y = yFor(point.y);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.lineTo(xFor(result.data[result.data.length - 1].x), yFor(0));
  context.lineTo(xFor(result.data[0].x), yFor(0));
  context.closePath();
  context.fillStyle = gradient;
  context.fill();

  context.beginPath();
  result.data.forEach((point, index) => {
    const x = xFor(point.x);
    const y = yFor(point.y);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.strokeStyle = "#286b8c";
  context.lineWidth = 2.5;
  context.stroke();
  elements.radial.setAttribute("aria-label", `${result.title}. ${result.caption}`);
  return result;
}

function drawWavefunctionSlice() {
  const { context, width, height } = resizeCanvas(elements.slice, 1.5);
  const settings = modelSettings();
  const extent = modelPlotExtent();
  const resolutionX = Math.min(240, Math.max(120, Math.round(width / 3)));
  const resolutionY = Math.min(190, Math.max(100, Math.round(height / 3)));
  const values = new Array(resolutionX * resolutionY);
  let maximum = 0;
  for (let row = 0; row < resolutionY; row += 1) {
    const z = (1 - ((row + 0.5) / resolutionY) * 2) * extent;
    for (let column = 0; column < resolutionX; column += 1) {
      const x = (((column + 0.5) / resolutionX) * 2 - 1) * extent;
      const value = settings.evaluator(x, 0, z);
      values[row * resolutionX + column] = value;
      maximum = Math.max(maximum, value.density);
    }
  }

  const offscreen = document.createElement("canvas");
  offscreen.width = resolutionX;
  offscreen.height = resolutionY;
  const offscreenContext = offscreen.getContext("2d");
  const image = offscreenContext.createImageData(resolutionX, resolutionY);
  values.forEach((value, index) => {
    const brightness = Math.pow(clamp(value.density / Math.max(1e-30, maximum), 0, 1), state.model === "neon" ? 0.18 : 0.24);
    let colour;
    if (state.model === "neon") {
      const mixture = state.neonComponent === "core" ? 1 : state.neonComponent === "valence" ? 0 : clamp(value.mixture ?? 0, 0, 1);
      colour = blendColour(VALENCE_BLUE, CORE_GOLD, mixture);
    } else {
      colour = phaseColour(value.phase ?? 0);
    }
    const ink = colour.map((channel) => channel * 0.74);
    image.data[index * 4] = Math.round(251 + (ink[0] - 251) * brightness);
    image.data[index * 4 + 1] = Math.round(250 + (ink[1] - 250) * brightness);
    image.data[index * 4 + 2] = Math.round(247 + (ink[2] - 247) * brightness);
    image.data[index * 4 + 3] = 255;
  });
  offscreenContext.putImageData(image, 0, 0);
  context.clearRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.drawImage(offscreen, 0, 0, width, height);

  context.save();
  context.strokeStyle = "rgba(32,32,29,.14)";
  context.lineWidth = 1;
  context.beginPath(); context.moveTo(width / 2, 0); context.lineTo(width / 2, height); context.stroke();
  context.beginPath(); context.moveTo(0, height / 2); context.lineTo(width, height / 2); context.stroke();
  context.fillStyle = "rgba(32,32,29,.92)";
  for (const centre of settings.centres) {
    const x = width / 2 + (centre.x / extent) * width / 2;
    const y = height / 2 - (centre.z / extent) * height / 2;
    context.beginPath(); context.arc(x, y, 3.5, 0, TAU); context.fill();
  }
  context.restore();

  const plane = state.model === "h3" ? "molecular x–z section" : "x–z plane";
  elements.sliceTitle.textContent = state.model === "neon" ? `${plane} · core/valence density` : `${plane} · wavefunction phase`;
  elements.sliceScale.textContent = `±${extent.toFixed(extent < 10 ? 1 : 0)} a₀`;
  elements.sliceCaption.textContent = state.model === "neon"
    ? "Colour separates compact 1s character from the n = 2 shell; brightness carries electron density."
    : "Colour carries complex phase; brightness carries |ψ|². Low-amplitude boundaries reveal nodes.";
  elements.slice.setAttribute("aria-label", `${elements.sliceTitle.textContent}. ${elements.sliceCaption.textContent}`);
}

function scheduleGraphs(delay = 40) {
  window.clearTimeout(graphTimer);
  graphTimer = window.setTimeout(() => {
    const radial = drawRadialGraph();
    drawWavefunctionSlice();
    runValidation(radial);
  }, delay);
}

function angularQuadrature(l, coefficientsA, coefficientsB = coefficientsA) {
  const phiSteps = 32;
  const dPhi = TAU / phiSteps;
  let real = 0;
  let imaginary = 0;
  for (const [cosTheta, thetaWeight] of GAUSS_LEGENDRE_12) {
    const theta = Math.acos(cosTheta);
    const weight = thetaWeight * dPhi;
    for (let phiIndex = 0; phiIndex < phiSteps; phiIndex += 1) {
      const phi = (phiIndex + 0.5) * dPhi;
      const left = angularCombination(l, coefficientsA, theta, phi);
      const right = angularCombination(l, coefficientsB, theta, phi);
      real += (left.re * right.re + left.im * right.im) * weight;
      imaginary += (left.re * right.im - left.im * right.re) * weight;
    }
  }
  return { re: real, im: imaginary };
}

function setCheck(key, value, passes, digits = 6) {
  const output = document.querySelector(`[data-check-${key}]`);
  const status = document.querySelector(`[data-check-status="${key}"]`);
  output.textContent = typeof value === "number" ? value.toFixed(digits) : value;
  status.textContent = passes ? "pass" : "review";
  status.dataset.state = passes ? "pass" : "fail";
  return passes;
}

function runValidation(radialResult = radialData()) {
  const coefficients = mMorphCoefficients(state.l, state.mPath, state.relativePhase);
  const angularNorm = angularQuadrature(state.l, coefficients).re;
  const adjacentM = state.l > 0 ? Math.min(state.l, -state.l + 1) : 0;
  const orthogonal = state.l > 0
    ? angularQuadrature(state.l, [{ m: -state.l, re: 1, im: 0 }], [{ m: adjacentM, re: 1, im: 0 }])
    : { re: 0, im: 0 };
  const orthogonalMagnitude = Math.hypot(orthogonal.re, orthogonal.im);
  const h2Result = h2MolecularOrbital(0, 0, 0, state.h2Distance, state.h2Parity);
  const h2Norm = 2 * (1 + (state.h2Parity > 0 ? 1 : -1) * h2Result.overlap) / h2Result.normalizationDenominator;
  const h3Result = h3MolecularOrbital(0, 0, 0, state.h3Distance);
  const h3Norm = quadraticForm(h3Result.coefficients, h3Result.overlap);
  if (cachedNeonSpatialCount === undefined) {
    cachedNeonSpatialCount = simpsonIntegrate((r) => (
      4 * Math.PI * r * r * neonElectronDensity(r, 0, 0).density
    ), 0, 6, 12_000);
  }
  const radialNorm = state.model === "morph" ? radialResult.integral : (() => {
    const maxR = Math.max(24, state.n * state.n * 5.5);
    return simpsonIntegrate((r) => {
      const value = radialWavefunction(state.n, state.l, r);
      return r * r * value * value;
    }, 0, maxR, 10000);
  })();

  const checks = [
    setCheck("radial", radialNorm, Math.abs(radialNorm - 1) < 2e-5),
    setCheck("angular", angularNorm, Math.abs(angularNorm - 1) < 5e-4),
    setCheck("orthogonal", orthogonalMagnitude, orthogonalMagnitude < 1e-6),
    setCheck("neon", cachedNeonSpatialCount, Math.abs(cachedNeonSpatialCount - neonElectronCount()) < 2e-5),
    setCheck("h2", h2Norm, Math.abs(h2Norm - 1) < 1e-12),
    setCheck("h3", h3Norm, Math.abs(h3Norm - 1) < 1e-12),
  ];
  const passCount = checks.filter(Boolean).length;
  elements.validationSummary.textContent = `${passCount}/6 checks pass · local deterministic calculation`;
  document.body.dataset.task10Status = passCount === 6 ? "verified" : "review";
}

function refresh({ sceneDelay = 55, graphDelay = 45 } = {}) {
  updateControlsAndText();
  scheduleSceneRebuild(sceneDelay);
  scheduleGraphs(graphDelay);
}

function setModel(model, scroll = false) {
  if (!["morph", "neon", "h2", "h3"].includes(model)) return;
  state.model = model;
  if (model !== "morph") setPlaying(false);
  refresh({ sceneDelay: 20, graphDelay: 20 });
  if (scroll) document.querySelector("#orbital-lab").scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth" });
}

function setPlaying(playing) {
  const wasPlaying = state.playing;
  state.playing = Boolean(playing) && state.l > 0 && state.model === "morph";
  updateControlsAndText();
  if (state.playing) {
    lastAnimationTime = performance.now();
    lastMorphSceneTime = lastAnimationTime;
    lastMorphGraphTime = lastAnimationTime;
    if (!animationFrame) animationFrame = requestAnimationFrame(animateMorph);
  } else if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  }
  if (wasPlaying && !state.playing) {
    scheduleSceneRebuild(0);
    scheduleGraphs(0);
  }
}

function resetLab() {
  setPlaying(false);
  Object.assign(state, DEFAULT_LAB_STATE);
  updateLChoices();
  updateMorphRange(false);
  refresh({ sceneDelay: 0, graphDelay: 0 });
  renderThree();
}

function animateMorph(time) {
  animationFrame = 0;
  if (!state.playing) return;
  const elapsed = Math.min(50, time - lastAnimationTime);
  lastAnimationTime = time;
  state.mPath += state.playDirection * elapsed * 0.00065 * Math.max(1, state.l);
  if (state.mPath >= state.l) {
    state.mPath = state.l;
    state.playDirection = -1;
  } else if (state.mPath <= -state.l) {
    state.mPath = -state.l;
    state.playDirection = 1;
  }
  elements.m.value = String(state.mPath);
  updateControlsAndText();
  if (time - lastMorphSceneTime >= 150) {
    lastMorphSceneTime = time;
    scheduleSceneRebuild(0);
  }
  if (time - lastMorphGraphTime >= 300) {
    lastMorphGraphTime = time;
    scheduleGraphs(0);
  }
  animationFrame = requestAnimationFrame(animateMorph);
}

function attachControls() {
  document.querySelectorAll("[data-model]").forEach((button) => button.addEventListener("click", () => setModel(button.dataset.model)));
  document.querySelectorAll("[data-jump-model]").forEach((button) => button.addEventListener("click", () => setModel(button.dataset.jumpModel, true)));
  elements.resetStateButtons.forEach((button) => button.addEventListener("click", resetLab));

  document.querySelectorAll("[data-orbital-preset]").forEach((button) => button.addEventListener("click", () => {
    const [n, l] = button.dataset.orbitalPreset.split(",").map(Number);
    state.n = n;
    state.l = l;
    updateLChoices();
    updateMorphRange(true);
    setPlaying(false);
    refresh({ sceneDelay: 15, graphDelay: 15 });
  }));

  elements.n.addEventListener("change", () => {
    state.n = Number(elements.n.value);
    updateLChoices();
    updateMorphRange(true);
    setPlaying(false);
    refresh();
  });
  elements.l.addEventListener("change", () => {
    state.l = Number(elements.l.value);
    updateMorphRange(true);
    setPlaying(false);
    refresh();
  });
  elements.m.addEventListener("input", () => {
    state.mPath = Number(elements.m.value);
    setPlaying(false);
    refresh({ sceneDelay: 35, graphDelay: 55 });
  });
  elements.phase.addEventListener("input", () => {
    state.relativePhase = Number(elements.phase.value) * Math.PI / 180;
    setPlaying(false);
    refresh({ sceneDelay: 35, graphDelay: 55 });
  });
  elements.morphPlay.addEventListener("click", () => setPlaying(!state.playing));

  document.querySelectorAll("[data-neon-component]").forEach((button) => button.addEventListener("click", () => {
    state.neonComponent = button.dataset.neonComponent;
    refresh({ sceneDelay: 15, graphDelay: 15 });
  }));
  document.querySelectorAll("[data-h2-parity]").forEach((button) => button.addEventListener("click", () => {
    state.h2Parity = Number(button.dataset.h2Parity);
    refresh({ sceneDelay: 15, graphDelay: 15 });
  }));
  elements.h2Distance.addEventListener("input", () => {
    state.h2Distance = Number(elements.h2Distance.value);
    refresh({ sceneDelay: 45, graphDelay: 50 });
  });
  elements.h3Distance.addEventListener("input", () => {
    state.h3Distance = Number(elements.h3Distance.value);
    refresh({ sceneDelay: 45, graphDelay: 50 });
  });

  document.querySelectorAll("[data-camera]").forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.camera === "reset") {
      state.yaw = -0.52;
      state.pitch = 0.34;
      state.zoom = 9;
    } else if (button.dataset.camera === "zoom-in") state.zoom = clamp(state.zoom - 0.8, 6.5, 13);
    else state.zoom = clamp(state.zoom + 0.8, 6.5, 13);
    renderThree();
  }));

  elements.canvas.addEventListener("pointerdown", (event) => {
    pointerDrag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    elements.canvas.setPointerCapture(event.pointerId);
  });
  elements.canvas.addEventListener("pointermove", (event) => {
    if (!pointerDrag || pointerDrag.id !== event.pointerId) return;
    state.yaw += (event.clientX - pointerDrag.x) * 0.008;
    state.pitch = clamp(state.pitch + (event.clientY - pointerDrag.y) * 0.008, -1.35, 1.35);
    pointerDrag.x = event.clientX;
    pointerDrag.y = event.clientY;
    renderThree();
  });
  const endPointer = (event) => {
    if (pointerDrag?.id === event.pointerId) pointerDrag = null;
  };
  elements.canvas.addEventListener("pointerup", endPointer);
  elements.canvas.addEventListener("pointercancel", endPointer);
  elements.canvas.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "+", "-", "="].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Home") {
      state.yaw = -0.52; state.pitch = 0.34; state.zoom = 9;
    } else if (event.key === "ArrowLeft") state.yaw -= 0.08;
    else if (event.key === "ArrowRight") state.yaw += 0.08;
    else if (event.key === "ArrowUp") state.pitch = clamp(state.pitch - 0.08, -1.35, 1.35);
    else if (event.key === "ArrowDown") state.pitch = clamp(state.pitch + 0.08, -1.35, 1.35);
    else if (["+", "="].includes(event.key)) state.zoom = clamp(state.zoom - 0.5, 6.5, 13);
    else state.zoom = clamp(state.zoom + 0.5, 6.5, 13);
    renderThree();
  });
}

function attachSectionNavigation() {
  const links = [...document.querySelectorAll(".section-nav a")];
  const sections = links.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean);
  const setCurrent = (id) => links.forEach((link) => {
    if (link.getAttribute("href") === `#${id}`) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  links.forEach((link) => link.addEventListener("click", () => setCurrent(link.getAttribute("href").slice(1))));
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
      if (visible) setCurrent(visible.target.id);
    }, { rootMargin: "-10% 0px -75% 0px", threshold: [0, 0.1, 0.25] });
    sections.forEach((section) => observer.observe(section));
  }
}

function initialize() {
  updateLChoices();
  updateMorphRange(false);
  initThree();
  attachControls();
  attachSectionNavigation();
  updateControlsAndText();
  scheduleSceneRebuild(10);
  scheduleGraphs(10);

  resizeObserver = new ResizeObserver(() => {
    resizeThree();
    drawRadialGraph();
    drawWavefunctionSlice();
    if (!webglAvailable) drawFallbackProjection();
  });
  [elements.viewport, elements.radial, elements.slice].forEach((element) => resizeObserver.observe(element));
  window.addEventListener("pagehide", () => {
    resizeObserver.disconnect();
    setPlaying(false);
    disposePoints();
    disposeNuclei();
    pointMaterial?.dispose();
    renderer?.dispose();
  }, { once: true });
}

initialize();
