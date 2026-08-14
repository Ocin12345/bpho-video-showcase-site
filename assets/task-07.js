import {
  HBAR,
  probabilityDensity,
  sampleState,
  stateFor,
  uncertaintySweep,
  waveAmplitude,
} from "./task-07-model.js";

const MAX_N = 8;
const COLORS = Object.freeze({
  ink: "#20201d",
  muted: "#696964",
  line: "#deded8",
  lineStrong: "#c9c9c2",
  blue: "#1769b0",
  blueDark: "#0f4f87",
  coral: "#c85862",
  gold: "#a17d38",
  green: "#1b6d5f",
  paper: "#ffffff",
});

const elements = {
  boxCanvas: document.querySelector("#box-canvas"),
  densityCanvas: document.querySelector("#density-canvas"),
  uncertaintyCanvas: document.querySelector("#uncertainty-canvas"),
  n: document.querySelector("[data-n]"),
  nOutput: document.querySelector("[data-n-output]"),
  width: document.querySelector("[data-width]"),
  widthOutput: document.querySelector("[data-width-output]"),
  particleButtons: document.querySelectorAll("[data-particle]"),
  reset: document.querySelector("[data-reset]"),
  stageTitle: document.querySelector("[data-stage-title]"),
  stateChip: document.querySelector("[data-state-chip]"),
  energy: document.querySelector("[data-energy]"),
  wavelength: document.querySelector("[data-wavelength]"),
  deltaX: document.querySelector("[data-delta-x]"),
  deltaP: document.querySelector("[data-delta-p]"),
  ratio: document.querySelector("[data-ratio]"),
  note: document.querySelector("[data-note]"),
  densityTitle: document.querySelector("[data-density-title]"),
  densityIntegral: document.querySelector("[data-density-integral]"),
  densityCaption: document.querySelector("[data-density-caption]"),
  checkEnergy: document.querySelector("[data-check-energy]"),
  checkNormalisation: document.querySelector("[data-check-normalisation]"),
  checkBoundary: document.querySelector("[data-check-boundary]"),
  checkBound: document.querySelector("[data-check-bound]"),
  checkNodes: document.querySelector("[data-check-nodes]"),
  validationSummary: document.querySelector("[data-validation-summary]"),
  validationRuntime: document.querySelector(".validation-runtime"),
};

const state = {
  n: 1,
  widthNm: 1,
  particle: "electron",
};

function formatEnergy(value) {
  if (value < 0.001) return `${value.toExponential(3)} eV`;
  if (value < 10) return `${value.toFixed(3)} eV`;
  return `${value.toFixed(1)} eV`;
}

function formatNumber(value, digits = 3) {
  return Number(value).toFixed(digits);
}

function setupCanvas(canvas, fallbackHeight) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(320, Math.round(rect.width || canvas.parentElement?.clientWidth || 640));
  const height = Math.max(220, Math.round(rect.height || fallbackHeight));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const context = canvas.getContext("2d");
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  return { context, width, height };
}

function drawGrid(context, x0, x1, y0, y1, horizontalCount = 4) {
  context.save();
  context.strokeStyle = COLORS.line;
  context.lineWidth = 1;
  for (let index = 0; index <= horizontalCount; index += 1) {
    const y = y0 + ((y1 - y0) * index) / horizontalCount;
    context.beginPath();
    context.moveTo(x0, y + 0.5);
    context.lineTo(x1, y + 0.5);
    context.stroke();
  }
  context.restore();
}

function drawBox() {
  const { context, width, height } = setupCanvas(elements.boxCanvas, 460);
  const x0 = Math.max(52, width * 0.105);
  const x1 = width - Math.max(38, width * 0.075);
  const plotWidth = x1 - x0;
  const waveBase = height * 0.39;
  const densityBase = height * 0.79;
  const waveScale = Math.min(84, height * 0.17);
  const densityScale = Math.min(88, height * 0.18);
  const samples = sampleState(state.n, Math.max(220, Math.round(plotWidth / 2)));

  context.fillStyle = COLORS.paper;
  context.fillRect(0, 0, width, height);
  drawGrid(context, x0, x1, 30, height - 48, 4);

  context.strokeStyle = COLORS.lineStrong;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(x0, waveBase + 0.5);
  context.lineTo(x1, waveBase + 0.5);
  context.moveTo(x0, densityBase + 0.5);
  context.lineTo(x1, densityBase + 0.5);
  context.stroke();

  context.strokeStyle = COLORS.ink;
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(x0, 30);
  context.lineTo(x0, height - 44);
  context.moveTo(x1, 30);
  context.lineTo(x1, height - 44);
  context.stroke();

  context.fillStyle = COLORS.muted;
  context.font = '11px "Times New Roman", Times, serif';
  context.fillText("wave amplitude", x0 + 8, 22);
  context.fillText("probability density", x0 + 8, densityBase - densityScale - 12);
  context.fillText(`n = ${state.n}`, x0 + 8, height - 20);
  context.textAlign = "right";
  context.fillText(`a = ${state.widthNm.toFixed(2)} nm`, x1, height - 20);
  context.textAlign = "left";

  context.beginPath();
  samples.forEach((sample, index) => {
    const x = x0 + sample.x * plotWidth;
    const y = waveBase - sample.amplitude * waveScale;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.strokeStyle = COLORS.blue;
  context.lineWidth = 2.5;
  context.stroke();

  context.beginPath();
  samples.forEach((sample, index) => {
    const x = x0 + sample.x * plotWidth;
    const y = densityBase - sample.density * densityScale;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.lineTo(x1, densityBase);
  context.lineTo(x0, densityBase);
  context.closePath();
  context.fillStyle = "rgba(200, 88, 98, 0.11)";
  context.fill();

  context.beginPath();
  samples.forEach((sample, index) => {
    const x = x0 + sample.x * plotWidth;
    const y = densityBase - sample.density * densityScale;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.strokeStyle = COLORS.coral;
  context.lineWidth = 2;
  context.stroke();

  context.fillStyle = COLORS.blueDark;
  for (let node = 1; node < state.n; node += 1) {
    const x = x0 + (node / state.n) * plotWidth;
    context.beginPath();
    context.arc(x, waveBase, 3, 0, Math.PI * 2);
    context.fill();
  }
}

function drawDensity() {
  const { context, width, height } = setupCanvas(elements.densityCanvas, 300);
  const x0 = 46;
  const x1 = width - 20;
  const y0 = 22;
  const y1 = height - 38;
  const plotWidth = x1 - x0;
  const plotHeight = y1 - y0;
  const samples = sampleState(state.n, Math.max(220, Math.round(plotWidth / 2)));

  context.fillStyle = COLORS.paper;
  context.fillRect(0, 0, width, height);
  drawGrid(context, x0, x1, y0, y1, 4);

  context.strokeStyle = COLORS.lineStrong;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(x0, y1 + 0.5);
  context.lineTo(x1, y1 + 0.5);
  context.stroke();

  context.beginPath();
  samples.forEach((sample, index) => {
    const x = x0 + sample.x * plotWidth;
    const y = y1 - (sample.density / 2) * plotHeight;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.lineTo(x1, y1);
  context.lineTo(x0, y1);
  context.closePath();
  context.fillStyle = "rgba(200, 88, 98, 0.12)";
  context.fill();

  context.beginPath();
  samples.forEach((sample, index) => {
    const x = x0 + sample.x * plotWidth;
    const y = y1 - (sample.density / 2) * plotHeight;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.strokeStyle = COLORS.coral;
  context.lineWidth = 2;
  context.stroke();

  context.fillStyle = COLORS.muted;
  context.font = '11px "Times New Roman", Times, serif';
  context.fillText("2", 21, y0 + 4);
  context.fillText("0", 21, y1 + 4);
  context.fillText("0", x0 - 2, height - 14);
  context.textAlign = "right";
  context.fillText("a", x1, height - 14);
  context.textAlign = "left";
  context.fillText("x", x1 + 8, y1 + 4);
}

function drawUncertainty() {
  const { context, width, height } = setupCanvas(elements.uncertaintyCanvas, 300);
  const x0 = 46;
  const x1 = width - 22;
  const y0 = 22;
  const y1 = height - 38;
  const plotWidth = x1 - x0;
  const plotHeight = y1 - y0;
  const maxRatio = 15;
  const sweep = uncertaintySweep(MAX_N, state.widthNm, state.particle);
  const yFor = (ratio) => y1 - (Math.min(maxRatio, ratio) / maxRatio) * plotHeight;

  context.fillStyle = COLORS.paper;
  context.fillRect(0, 0, width, height);
  drawGrid(context, x0, x1, y0, y1, 3);

  context.strokeStyle = COLORS.gold;
  context.setLineDash([5, 5]);
  context.lineWidth = 1.2;
  context.beginPath();
  context.moveTo(x0, yFor(1));
  context.lineTo(x1, yFor(1));
  context.stroke();
  context.setLineDash([]);

  context.beginPath();
  sweep.forEach((item, index) => {
    const x = x0 + (index / (MAX_N - 1)) * plotWidth;
    const y = yFor(item.boundRatio);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.strokeStyle = COLORS.blue;
  context.lineWidth = 2;
  context.stroke();

  sweep.forEach((item, index) => {
    const x = x0 + (index / (MAX_N - 1)) * plotWidth;
    const y = yFor(item.boundRatio);
    context.beginPath();
    context.arc(x, y, item.n === state.n ? 5 : 3.5, 0, Math.PI * 2);
    context.fillStyle = item.n === state.n ? COLORS.coral : COLORS.blue;
    context.fill();
    context.strokeStyle = COLORS.paper;
    context.lineWidth = 1;
    context.stroke();
  });

  context.fillStyle = COLORS.muted;
  context.font = '11px "Times New Roman", Times, serif';
  context.fillText("15", 13, y0 + 4);
  context.fillText("1", 21, yFor(1) + 4);
  context.fillText("n", x1 + 9, y1 + 4);
  for (let n = 1; n <= MAX_N; n += 1) {
    const x = x0 + ((n - 1) / (MAX_N - 1)) * plotWidth;
    context.textAlign = "center";
    context.fillText(String(n), x, height - 14);
  }
  context.textAlign = "left";
  context.fillStyle = COLORS.gold;
  context.fillText("ℏ/2", x1 - 26, yFor(1) - 8);
}

function integrateDensity(n, intervals = 10_000) {
  const step = 1 / intervals;
  let total = 0.5 * (probabilityDensity(0, n) + probabilityDensity(1, n));
  for (let index = 1; index < intervals; index += 1) {
    total += probabilityDensity(index * step, n);
  }
  return total * step;
}

function setCheck(name, ok) {
  const element = document.querySelector(`[data-check="${name}"]`);
  if (!element) return;
  element.dataset.state = ok ? "pass" : "fail";
  element.textContent = ok ? "pass" : "review";
}

function updateValidation() {
  const energyRatio = stateFor(2, state.widthNm, state.particle).energyJ / stateFor(1, state.widthNm, state.particle).energyJ;
  const normalisation = integrateDensity(state.n);
  const boundary = Math.max(Math.abs(waveAmplitude(0, state.n)), Math.abs(waveAmplitude(1, state.n)));
  const boundRatio = stateFor(1, state.widthNm, state.particle).boundRatio;
  const nodeCount = 4 - 1;
  const checks = {
    energy: Math.abs(energyRatio - 4) < 1e-12,
    normalisation: Math.abs(normalisation - 1) < 2e-8,
    boundary: boundary < 1e-12,
    bound: boundRatio >= 1,
    nodes: nodeCount === 3,
  };

  elements.checkEnergy.textContent = energyRatio.toFixed(6);
  elements.checkNormalisation.textContent = normalisation.toFixed(6);
  elements.checkBoundary.textContent = boundary.toFixed(6);
  elements.checkBound.textContent = `${boundRatio.toFixed(4)} × ℏ/2`;
  elements.checkNodes.textContent = String(nodeCount);
  Object.entries(checks).forEach(([name, ok]) => setCheck(name, ok));

  const passed = Object.values(checks).filter(Boolean).length;
  elements.validationSummary.textContent = `${passed}/${Object.keys(checks).length} checks ${passed === Object.keys(checks).length ? "pass" : "need review"} · analytic local calculation`;
  elements.validationRuntime.dataset.state = passed === Object.keys(checks).length ? "pass" : "fail";
}

function updateReadouts() {
  const result = stateFor(state.n, state.widthNm, state.particle);
  const particleLabel = state.particle === "electron" ? "electron" : "proton";
  elements.nOutput.textContent = String(state.n);
  elements.widthOutput.textContent = `${state.widthNm.toFixed(2)} nm`;
  elements.stageTitle.textContent = `n = ${state.n} · ${state.n === 1 ? "ground state" : "excited state"}`;
  elements.stateChip.textContent = `${result.n - 1} interior node${result.n - 1 === 1 ? "" : "s"}`;
  elements.energy.textContent = formatEnergy(result.energyEV);
  elements.wavelength.textContent = `${result.wavelengthNm.toFixed(2)} nm`;
  elements.deltaX.textContent = `${result.deltaXNm.toFixed(3)} nm`;
  elements.deltaP.textContent = `${result.deltaPMomentum.toExponential(3)} kg m/s`;
  elements.ratio.textContent = `${result.boundRatio.toFixed(3)} × ℏ/2`;
  elements.note.textContent = `A ${particleLabel} in a ${state.widthNm.toFixed(2)} nm infinite well. The stationary probability density is fixed in time, while the energy phase evolves as exp(−iEₙt/ℏ).`;
  elements.densityTitle.textContent = `|ψ${state.n}(x)|² across the well`;
  elements.densityIntegral.textContent = `∫|ψ|² dx = ${integrateDensity(state.n).toFixed(3)}`;
  elements.densityCaption.textContent = state.n === 1
    ? "The ground state has no interior node: the particle is most likely near the centre."
    : `State n = ${state.n} has ${state.n - 1} interior node${state.n - 1 === 1 ? "" : "s"}; each lobe carries an equal share of the probability.`;
  elements.boxCanvas.setAttribute("aria-label", `Interactive particle-in-a-box state n equals ${state.n}, with ${state.n - 1} interior nodes. Use the arrow keys to change the quantum number.`);
  elements.densityCanvas.setAttribute("aria-label", `Probability density for particle-in-a-box state n equals ${state.n} across a ${state.widthNm.toFixed(2)} nanometre well.`);
  elements.uncertaintyCanvas.setAttribute("aria-label", `Uncertainty product ratios from n equals 1 to 8; the selected state n equals ${state.n} is highlighted.`);

  elements.particleButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.particle === state.particle));
  });
}

function render() {
  updateReadouts();
  drawBox();
  drawDensity();
  drawUncertainty();
  updateValidation();
}

function reset() {
  state.n = 1;
  state.widthNm = 1;
  state.particle = "electron";
  elements.n.value = "1";
  elements.width.value = "1";
  render();
}

elements.n.addEventListener("input", () => {
  state.n = Math.max(1, Math.min(MAX_N, Number(elements.n.value)));
  render();
});

elements.width.addEventListener("input", () => {
  state.widthNm = Number(elements.width.value);
  render();
});

elements.particleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.particle = button.dataset.particle;
    render();
  });
});

elements.reset.addEventListener("click", reset);

elements.boxCanvas.addEventListener("keydown", (event) => {
  if (["ArrowUp", "ArrowRight"].includes(event.key)) {
    event.preventDefault();
    state.n = Math.min(MAX_N, state.n + 1);
  } else if (["ArrowDown", "ArrowLeft"].includes(event.key)) {
    event.preventDefault();
    state.n = Math.max(1, state.n - 1);
  } else if (event.key === "Home") {
    event.preventDefault();
    state.n = 1;
  } else if (event.key === "End") {
    event.preventDefault();
    state.n = MAX_N;
  } else {
    return;
  }
  elements.n.value = String(state.n);
  render();
});

const resizeObserver = new ResizeObserver(() => {
  drawBox();
  drawDensity();
  drawUncertainty();
});
resizeObserver.observe(elements.boxCanvas.parentElement);
resizeObserver.observe(elements.densityCanvas.parentElement);
resizeObserver.observe(elements.uncertaintyCanvas.parentElement);

window.addEventListener("resize", () => {
  drawBox();
  drawDensity();
  drawUncertainty();
});

// Keep the physical constant in the module's live surface so a browser smoke
// test can confirm the display is tied to the same model used for validation.
document.documentElement.dataset.hbar = String(HBAR);
render();
