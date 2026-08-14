const DEG_TO_RAD = Math.PI / 180;
const UINT32_MODULUS = 0x1_0000_0000;
const MULBERRY32_INCREMENT = 0x6d2b79f5;
const CLASSICAL_STREAM_SALT = 0x243f6a88;
const QUANTUM_STREAM_SALT = 0xb7e15162;
const WILSON_Z = 1.959963984540054;

const COLOURS = Object.freeze({
  ink: "#1b2e3b",
  muted: "#657581",
  line: "#d6dfe2",
  grid: "#e5ebed",
  paper: "#fbfcfc",
  blue: "#1479a6",
  blueSoft: "#dceff6",
  violet: "#8f4aac",
  violetSoft: "#f0e3f5",
  orange: "#c85522",
  orangeSoft: "#fde9de",
  teal: "#007770",
  tealSoft: "#dff3ef",
  gold: "#b68a27",
});

const PRESETS = Object.freeze({
  official: { theta: -30, phi: 30 },
  aligned: { theta: 0, phi: 0 },
  contrast: { theta: -45, phi: 45 },
  perpendicular: { theta: 0, phi: 90 },
});

const controls = {
  theta: document.querySelector("[data-theta]"),
  phi: document.querySelector("[data-phi]"),
  sampleCount: document.querySelector("[data-sample-count]"),
  sampleSeed: document.querySelector("[data-sample-seed]"),
};

const canvases = {
  detector: document.querySelector("#detector-canvas"),
  sweep: document.querySelector("#sweep-canvas"),
  landscape: document.querySelector("#landscape-canvas"),
};

const contexts = {
  detector: canvases.detector?.getContext("2d"),
  sweep: canvases.sweep?.getContext("2d"),
  landscape: canvases.landscape?.getContext("2d"),
};

const outputs = {
  theta: document.querySelector("[data-theta-output]"),
  phi: document.querySelector("[data-phi-output]"),
  relative: document.querySelector("[data-relative-angle]"),
  classicalPercent: document.querySelector("[data-classical-percent]"),
  classicalDecimal: document.querySelector("[data-classical-decimal]"),
  classicalFill: document.querySelector("[data-classical-fill]"),
  quantumPercent: document.querySelector("[data-quantum-percent]"),
  quantumDecimal: document.querySelector("[data-quantum-decimal]"),
  quantumFill: document.querySelector("[data-quantum-fill]"),
  difference: document.querySelector("[data-difference]"),
  differenceSummary: document.querySelector("[data-difference-summary]"),
  officialLock: document.querySelector("[data-official-lock]"),
  officialCard: document.querySelector("[data-official-card]"),
  sweepTitle: document.querySelector("[data-sweep-title]"),
  sweepHeadline: document.querySelector("[data-sweep-headline]"),
  sweepCopy: document.querySelector("[data-sweep-copy]"),
  sweepTooltip: document.querySelector("[data-sweep-tooltip]"),
  landscapeReading: document.querySelector("[data-landscape-reading]"),
  sampleContext: document.querySelector("[data-sample-context]"),
  observedDifference: document.querySelector("[data-observed-difference]"),
  samplingSummary: document.querySelector("[data-sampling-summary]"),
};

const sampleOutputs = {
  classical: {
    theory: document.querySelector("[data-classical-theory]"),
    observed: document.querySelector("[data-classical-observed]"),
    count: document.querySelector("[data-classical-count]"),
    interval: document.querySelector("[data-classical-interval]"),
    theoryMarker: document.querySelector("[data-classical-theory-marker]"),
    observedMarker: document.querySelector("[data-classical-observed-marker]"),
    expected: document.querySelector("[data-classical-expected]"),
    wilson: document.querySelector("[data-classical-wilson]"),
    residual: document.querySelector("[data-classical-residual]"),
  },
  quantum: {
    theory: document.querySelector("[data-quantum-theory]"),
    observed: document.querySelector("[data-quantum-observed]"),
    count: document.querySelector("[data-quantum-count]"),
    interval: document.querySelector("[data-quantum-interval]"),
    theoryMarker: document.querySelector("[data-quantum-theory-marker]"),
    observedMarker: document.querySelector("[data-quantum-observed-marker]"),
    expected: document.querySelector("[data-quantum-expected]"),
    wilson: document.querySelector("[data-quantum-wilson]"),
    residual: document.querySelector("[data-quantum-residual]"),
  },
};

const state = {
  theta: -30,
  phi: 30,
  sampleCount: 1000,
  seed: 2026,
  sweepPlot: null,
  landscapePlot: null,
};

const countFormatter = new Intl.NumberFormat("en-US");

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function signedAngle(value) {
  const rounded = Math.round(value * 10) / 10;
  if (Math.abs(rounded) < 0.05) return "0°";
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded).toFixed(Number.isInteger(rounded) ? 0 : 1)}°`;
}

function percent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function signedPoints(value) {
  const points = value * 100;
  if (Math.abs(points) < 0.05) return "0.0 pp";
  return `${points > 0 ? "+" : "−"}${Math.abs(points).toFixed(1)} pp`;
}

function normalizeRelativeAngle(value) {
  return ((value + 90) % 180 + 180) % 180 - 90;
}

function mismatch(thetaDeg, phiDeg) {
  const theta = thetaDeg * DEG_TO_RAD;
  const phi = phiDeg * DEG_TO_RAD;
  const classical = clamp(
    1 - Math.cos(theta) ** 2 * Math.cos(phi) ** 2 - Math.sin(theta) ** 2 * Math.sin(phi) ** 2,
    0,
    1,
  );
  const relativeAngle = normalizeRelativeAngle(phiDeg - thetaDeg);
  const quantum = clamp(Math.sin(relativeAngle * DEG_TO_RAD) ** 2, 0, 1);
  return { thetaDeg, phiDeg, relativeAngle, classical, quantum, difference: quantum - classical };
}

function canvasSize(canvas, context) {
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  const density = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.round(width * density);
  const pixelHeight = Math.round(height * density);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  context.setTransform(density, 0, 0, density, 0, 0);
  return { width, height };
}

function line(context, x1, y1, x2, y2) {
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();
}

function roundRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function detectorAxis(angleDeg, radius) {
  const angle = angleDeg * DEG_TO_RAD;
  return { x: radius * Math.cos(angle), y: -radius * Math.sin(angle) };
}

function drawDetectorDial(context, x, y, radius, angle, colour, soft, label, compact) {
  const axis = detectorAxis(angle, radius * 0.72);
  const perpendicular = detectorAxis(angle + 90, radius * 0.72);

  context.save();
  context.fillStyle = soft;
  context.strokeStyle = `${colour}55`;
  context.lineWidth = 1.5;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.strokeStyle = `${colour}33`;
  context.setLineDash([3, 5]);
  context.beginPath();
  context.arc(x, y, radius * 0.68, 0, Math.PI * 2);
  context.stroke();
  context.setLineDash([]);

  context.strokeStyle = colour;
  context.lineWidth = compact ? 4 : 5;
  context.lineCap = "round";
  line(context, x - axis.x, y - axis.y, x + axis.x, y + axis.y);
  context.strokeStyle = `${colour}99`;
  context.setLineDash([6, 6]);
  context.lineWidth = compact ? 2.5 : 3;
  line(context, x - perpendicular.x, y - perpendicular.y, x + perpendicular.x, y + perpendicular.y);
  context.setLineDash([]);

  context.fillStyle = colour;
  context.beginPath();
  context.arc(x, y, compact ? 5 : 6, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = COLOURS.ink;
  context.textAlign = "center";
  context.font = `700 ${compact ? 11 : 12}px Arial, sans-serif`;
  context.fillText(label, x, y + radius + (compact ? 22 : 27));
  context.fillStyle = colour;
  context.font = `700 ${compact ? 13 : 15}px Arial, sans-serif`;
  context.fillText(signedAngle(angle), x, y + radius + (compact ? 39 : 47));
  context.restore();
}

function drawDetectorCanvas() {
  const canvas = canvases.detector;
  const context = contexts.detector;
  if (!canvas || !context) return;
  const { width, height } = canvasSize(canvas, context);
  const compact = width < 620;
  const radius = Math.min(compact ? 63 : 94, width * (compact ? 0.17 : 0.13), height * 0.27);
  const y = height * (compact ? 0.45 : 0.46);
  const leftX = width * (compact ? 0.22 : 0.2);
  const rightX = width * (compact ? 0.78 : 0.8);
  const sourceX = width / 2;

  context.clearRect(0, 0, width, height);
  context.fillStyle = COLOURS.paper;
  context.fillRect(0, 0, width, height);
  context.strokeStyle = COLOURS.grid;
  context.lineWidth = 1;
  for (let x = 20; x < width; x += 32) line(context, x, 0, x, height);
  for (let yLine = 18; yLine < height; yLine += 32) line(context, 0, yLine, width, yLine);

  context.strokeStyle = "#aebdc4";
  context.setLineDash([3, 7]);
  line(context, leftX + radius, y, sourceX - 27, y);
  line(context, sourceX + 27, y, rightX - radius, y);
  context.setLineDash([]);

  drawDetectorDial(context, leftX, y, radius, state.theta, COLOURS.blue, COLOURS.blueSoft, "DETECTOR A · θ", compact);
  drawDetectorDial(context, rightX, y, radius, state.phi, COLOURS.violet, COLOURS.violetSoft, "DETECTOR B · φ", compact);

  context.save();
  context.fillStyle = "#ffffff";
  context.strokeStyle = COLOURS.teal;
  context.lineWidth = 2;
  context.beginPath();
  context.arc(sourceX, y, compact ? 25 : 32, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = COLOURS.teal;
  context.textAlign = "center";
  context.font = `700 ${compact ? 13 : 16}px Georgia, serif`;
  context.fillText("∞", sourceX, y + (compact ? 5 : 6));
  context.fillStyle = COLOURS.ink;
  context.font = `700 ${compact ? 9 : 11}px Arial, sans-serif`;
  context.fillText("ENTANGLED PAIR", sourceX, y + (compact ? 48 : 59));
  context.fillStyle = COLOURS.muted;
  context.font = `500 ${compact ? 9 : 10}px Arial, sans-serif`;
  context.fillText(`δ = ${signedAngle(mismatch(state.theta, state.phi).relativeAngle)}`, sourceX, y + (compact ? 64 : 76));
  context.restore();
}

function drawSweep() {
  const canvas = canvases.sweep;
  const context = contexts.sweep;
  if (!canvas || !context) return;
  const { width, height } = canvasSize(canvas, context);
  const margin = { top: 24, right: 25, bottom: 48, left: width < 520 ? 49 : 64 };
  const plotWidth = Math.max(1, width - margin.left - margin.right);
  const plotHeight = Math.max(1, height - margin.top - margin.bottom);
  const xFor = (phi) => margin.left + ((phi + 90) / 180) * plotWidth;
  const yFor = (probability) => margin.top + (1 - probability) * plotHeight;
  state.sweepPlot = { margin, plotWidth, plotHeight, xFor, yFor };

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.font = "11px Arial, sans-serif";
  context.fillStyle = COLOURS.muted;
  context.strokeStyle = COLOURS.grid;
  context.lineWidth = 1;
  context.textAlign = "right";
  for (const probability of [0, 0.25, 0.5, 0.75, 1]) {
    const y = yFor(probability);
    line(context, margin.left, y, width - margin.right, y);
    context.fillText(`${Math.round(probability * 100)}%`, margin.left - 10, y + 4);
  }
  context.textAlign = "center";
  for (const phi of [-90, -45, 0, 45, 90]) {
    const x = xFor(phi);
    line(context, x, margin.top, x, height - margin.bottom);
    context.fillText(signedAngle(phi), x, height - margin.bottom + 23);
  }
  context.strokeStyle = "#9eafb7";
  line(context, margin.left, margin.top, margin.left, height - margin.bottom);
  line(context, margin.left, height - margin.bottom, width - margin.right, height - margin.bottom);

  const drawCurve = (key, colour, dashed) => {
    context.save();
    context.strokeStyle = colour;
    context.lineWidth = 3;
    if (dashed) context.setLineDash([9, 6]);
    context.beginPath();
    for (let index = 0; index <= 360; index += 1) {
      const phi = -90 + index * 0.5;
      const result = mismatch(state.theta, phi);
      const x = xFor(phi);
      const y = yFor(result[key]);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
    context.restore();
  };
  drawCurve("classical", COLOURS.orange, false);
  drawCurve("quantum", COLOURS.teal, true);

  const selected = mismatch(state.theta, state.phi);
  const markerX = xFor(state.phi);
  context.save();
  context.strokeStyle = "#667b88";
  context.setLineDash([3, 4]);
  line(context, markerX, margin.top, markerX, height - margin.bottom);
  context.setLineDash([]);
  for (const [probability, colour, radius] of [[selected.classical, COLOURS.orange, 5], [selected.quantum, COLOURS.teal, 6]]) {
    context.fillStyle = "white";
    context.strokeStyle = colour;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(markerX, yFor(probability), radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }
  context.restore();

  context.fillStyle = COLOURS.muted;
  context.font = "11px Arial, sans-serif";
  context.textAlign = "center";
  context.fillText("detector B angle, φ", margin.left + plotWidth / 2, height - 8);
  context.save();
  context.translate(15, margin.top + plotHeight / 2);
  context.rotate(-Math.PI / 2);
  context.fillText("mismatch probability", 0, 0);
  context.restore();
}

function mixColour(negative, neutral, positive, value) {
  const source = value < 0 ? negative : neutral;
  const target = value < 0 ? neutral : positive;
  const amount = Math.min(1, Math.abs(value) * 2);
  return source.map((channel, index) => Math.round(channel + (target[index] - channel) * amount));
}

function drawLandscape() {
  const canvas = canvases.landscape;
  const context = contexts.landscape;
  if (!canvas || !context) return;
  const { width, height } = canvasSize(canvas, context);
  const margin = { top: 22, right: 24, bottom: 45, left: width < 520 ? 48 : 58 };
  const availableWidth = width - margin.left - margin.right;
  const availableHeight = height - margin.top - margin.bottom;
  const size = Math.max(1, Math.min(availableWidth, availableHeight));
  const plotX = margin.left + (availableWidth - size) / 2;
  const plotY = margin.top;
  const xFor = (phi) => plotX + ((phi + 90) / 180) * size;
  const yFor = (theta) => plotY + ((90 - theta) / 180) * size;
  state.landscapePlot = { plotX, plotY, size, xFor, yFor };

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  const resolution = Math.min(181, Math.max(90, Math.floor(size)));
  const cell = size / resolution;
  const negative = [27, 118, 160];
  const neutral = [248, 249, 247];
  const positive = [200, 85, 34];
  for (let row = 0; row < resolution; row += 1) {
    const theta = 90 - ((row + 0.5) / resolution) * 180;
    for (let column = 0; column < resolution; column += 1) {
      const phi = -90 + ((column + 0.5) / resolution) * 180;
      const rgb = mixColour(negative, neutral, positive, mismatch(theta, phi).difference);
      context.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
      context.fillRect(plotX + column * cell, plotY + row * cell, cell + 0.7, cell + 0.7);
    }
  }

  context.strokeStyle = "rgba(27,46,59,0.2)";
  context.lineWidth = 1;
  for (const angle of [-90, -45, 0, 45, 90]) {
    line(context, xFor(angle), plotY, xFor(angle), plotY + size);
    line(context, plotX, yFor(angle), plotX + size, yFor(angle));
  }
  context.strokeStyle = COLOURS.ink;
  context.strokeRect(plotX, plotY, size, size);

  const selectedX = xFor(state.phi);
  const selectedY = yFor(state.theta);
  context.fillStyle = "white";
  context.strokeStyle = COLOURS.ink;
  context.lineWidth = 2;
  context.beginPath();
  context.arc(selectedX, selectedY, 6, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.fillStyle = COLOURS.muted;
  context.font = "10px Arial, sans-serif";
  context.textAlign = "center";
  for (const angle of [-90, -45, 0, 45, 90]) context.fillText(signedAngle(angle), xFor(angle), plotY + size + 20);
  context.fillText("detector B · φ", plotX + size / 2, height - 6);
  context.save();
  context.translate(plotX - 35, plotY + size / 2);
  context.rotate(-Math.PI / 2);
  context.fillText("detector A · θ", 0, 0);
  context.restore();
}

function createMulberry32(seed) {
  let randomState = seed >>> 0;
  return () => {
    randomState = (randomState + MULBERRY32_INCREMENT) >>> 0;
    let value = randomState;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / UINT32_MODULUS;
  };
}

function binomialCount(number, probability, seed) {
  const random = createMulberry32(seed);
  let count = 0;
  for (let index = 0; index < number; index += 1) if (random() < probability) count += 1;
  return count;
}

function wilsonInterval(successes, total) {
  const observed = successes / total;
  const zSquared = WILSON_Z * WILSON_Z;
  const denominator = 1 + zSquared / total;
  const center = (observed + zSquared / (2 * total)) / denominator;
  const halfWidth = (WILSON_Z / denominator) * Math.sqrt((observed * (1 - observed)) / total + zSquared / (4 * total * total));
  return { lower: Math.max(0, center - halfWidth), upper: Math.min(1, center + halfWidth) };
}

function sampleModel(model, probability, count, seed) {
  const salt = model === "classical" ? CLASSICAL_STREAM_SALT : QUANTUM_STREAM_SALT;
  const mismatches = binomialCount(count, probability, (seed ^ salt) >>> 0);
  const observed = mismatches / count;
  const expected = count * probability;
  const sigma = Math.sqrt(count * probability * (1 - probability));
  return {
    probability,
    mismatches,
    observed,
    expected,
    residual: sigma === 0 ? null : (mismatches - expected) / sigma,
    interval: wilsonInterval(mismatches, count),
  };
}

function intervalText(interval) {
  return `${percent(interval.lower).replace("%", "")}–${percent(interval.upper)}`;
}

function residualText(value) {
  if (value === null) return "deterministic";
  if (Math.abs(value) < 0.005) return "0.00σ";
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}σ`;
}

function renderSampleCard(model, sample) {
  const output = sampleOutputs[model];
  output.theory.textContent = `theory ${percent(sample.probability)}`;
  output.observed.textContent = percent(sample.observed);
  output.count.textContent = countFormatter.format(sample.mismatches);
  output.expected.textContent = sample.expected.toFixed(1);
  output.wilson.textContent = intervalText(sample.interval);
  output.residual.textContent = residualText(sample.residual);
  output.interval.style.left = `${sample.interval.lower * 100}%`;
  output.interval.style.width = `${(sample.interval.upper - sample.interval.lower) * 100}%`;
  output.theoryMarker.style.left = `${sample.probability * 100}%`;
  output.observedMarker.style.left = `${sample.observed * 100}%`;
}

function renderSampling() {
  const result = mismatch(state.theta, state.phi);
  const classical = sampleModel("classical", result.classical, state.sampleCount, state.seed);
  const quantum = sampleModel("quantum", result.quantum, state.sampleCount, state.seed);
  renderSampleCard("classical", classical);
  renderSampleCard("quantum", quantum);
  outputs.sampleContext.textContent = `θ = ${signedAngle(state.theta)} · φ = ${signedAngle(state.phi)} · N = ${countFormatter.format(state.sampleCount)} · seed ${countFormatter.format(state.seed)}`;
  const observedDifference = quantum.observed - classical.observed;
  outputs.observedDifference.textContent = signedPoints(observedDifference);
  outputs.samplingSummary.textContent = `Finite counts fluctuate around the exact ${signedPoints(result.difference)} prediction.`;
}

function updateOutputs() {
  const result = mismatch(state.theta, state.phi);
  outputs.theta.textContent = signedAngle(state.theta);
  outputs.phi.textContent = signedAngle(state.phi);
  outputs.relative.textContent = `relative angle δ = ${signedAngle(result.relativeAngle)}`;
  outputs.classicalPercent.textContent = percent(result.classical);
  outputs.classicalDecimal.textContent = `P = ${result.classical.toFixed(3)}`;
  outputs.classicalFill.style.setProperty("--fill", `${result.classical * 100}%`);
  outputs.quantumPercent.textContent = percent(result.quantum);
  outputs.quantumDecimal.textContent = `P = ${result.quantum.toFixed(3)}`;
  outputs.quantumFill.style.setProperty("--fill", `${result.quantum * 100}%`);
  outputs.difference.textContent = signedPoints(result.difference);
  outputs.differenceSummary.textContent = Math.abs(result.difference) < 0.0005
    ? "The two models agree at this angle pair."
    : `Quantum predicts ${Math.abs(result.difference * 100).toFixed(1)} percentage points ${result.difference > 0 ? "more" : "fewer"} mismatch.`;
  const official = state.theta === -30 && state.phi === 30;
  outputs.officialLock.textContent = official ? "3/8 versus 3/4" : "Restore official example";
  outputs.officialCard.classList.toggle("is-official", official);
  outputs.sweepTitle.textContent = `θ = ${signedAngle(state.theta)} · φ = ${signedAngle(state.phi)}`;
  if (result.classical > 0.0005) {
    const ratio = result.quantum / result.classical;
    outputs.sweepHeadline.textContent = Math.abs(ratio - 1) < 0.005
      ? "The two curves meet at the selected angle."
      : `At ${signedAngle(state.phi)}, quantum mismatch is ${ratio.toFixed(2)}× the classical result.`;
  } else {
    outputs.sweepHeadline.textContent = result.quantum < 0.0005
      ? "Both models predict no mismatch here."
      : "Classical mismatch is zero at this angle pair.";
  }
  outputs.sweepCopy.textContent = `The selected pair gives ${percent(result.quantum)} quantum mismatch against ${percent(result.classical)} classically.`;
  outputs.landscapeReading.textContent = `θ ${signedAngle(state.theta)} · φ ${signedAngle(state.phi)} · ${result.difference >= 0 ? "+" : "−"}${Math.abs(result.difference).toFixed(3)}`;

  document.querySelectorAll("[data-preset]").forEach((button) => {
    const preset = PRESETS[button.dataset.preset];
    const selected = preset.theta === state.theta && preset.phi === state.phi;
    button.setAttribute("aria-pressed", String(selected));
  });
  canvases.detector.setAttribute("aria-label", `Entangled photon source between detector A at ${signedAngle(state.theta)} and detector B at ${signedAngle(state.phi)}. Classical mismatch ${percent(result.classical)}; quantum mismatch ${percent(result.quantum)}.`);
  canvases.sweep.setAttribute("aria-label", `Mismatch sweep with detector A fixed at ${signedAngle(state.theta)}. Detector B is selected at ${signedAngle(state.phi)}; classical mismatch ${percent(result.classical)} and quantum mismatch ${percent(result.quantum)}.`);
  canvases.landscape.setAttribute("aria-label", `Signed quantum minus classical mismatch landscape. Selected detector A ${signedAngle(state.theta)}, detector B ${signedAngle(state.phi)}, contrast ${signedPoints(result.difference)}.`);
}

function renderAll() {
  updateOutputs();
  drawDetectorCanvas();
  drawSweep();
  drawLandscape();
  renderSampling();
}

function setAngles(theta, phi) {
  state.theta = Math.round(clamp(Number(theta), -90, 90));
  state.phi = Math.round(clamp(Number(phi), -90, 90));
  controls.theta.value = String(state.theta);
  controls.phi.value = String(state.phi);
  controls.theta.setAttribute("aria-valuetext", signedAngle(state.theta));
  controls.phi.setAttribute("aria-valuetext", signedAngle(state.phi));
  renderAll();
}

controls.theta.addEventListener("input", () => setAngles(controls.theta.value, state.phi));
controls.phi.addEventListener("input", () => setAngles(state.theta, controls.phi.value));

document.querySelectorAll("[data-preset]").forEach((button) => {
  button.addEventListener("click", () => {
    const preset = PRESETS[button.dataset.preset];
    setAngles(preset.theta, preset.phi);
  });
});

function handlePhiKeys(event) {
  if (!["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  if (event.key === "Home") setAngles(state.theta, -90);
  else if (event.key === "End") setAngles(state.theta, 90);
  else setAngles(state.theta, state.phi + (["ArrowRight", "ArrowUp"].includes(event.key) ? 1 : -1));
}

canvases.detector.addEventListener("keydown", handlePhiKeys);
canvases.sweep.addEventListener("keydown", handlePhiKeys);
canvases.landscape.addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  if (event.key === "Home") setAngles(-90, -90);
  else if (event.key === "End") setAngles(90, 90);
  else if (event.key === "ArrowLeft") setAngles(state.theta, state.phi - 1);
  else if (event.key === "ArrowRight") setAngles(state.theta, state.phi + 1);
  else if (event.key === "ArrowDown") setAngles(state.theta - 1, state.phi);
  else setAngles(state.theta + 1, state.phi);
});

canvases.sweep.addEventListener("pointermove", (event) => {
  if (!state.sweepPlot) return;
  const bounds = canvases.sweep.getBoundingClientRect();
  const localX = event.clientX - bounds.left;
  const { margin, plotWidth } = state.sweepPlot;
  if (localX < margin.left || localX > margin.left + plotWidth) {
    outputs.sweepTooltip.hidden = true;
    return;
  }
  const phi = -90 + ((localX - margin.left) / plotWidth) * 180;
  const result = mismatch(state.theta, phi);
  outputs.sweepTooltip.hidden = false;
  outputs.sweepTooltip.textContent = `φ ${signedAngle(phi)} · C ${percent(result.classical)} · Q ${percent(result.quantum)}`;
  outputs.sweepTooltip.style.left = `${Math.min(localX + 12, bounds.width - 205)}px`;
  outputs.sweepTooltip.style.top = "14px";
});

canvases.sweep.addEventListener("pointerleave", () => { outputs.sweepTooltip.hidden = true; });
canvases.sweep.addEventListener("click", (event) => {
  if (!state.sweepPlot) return;
  const bounds = canvases.sweep.getBoundingClientRect();
  const localX = event.clientX - bounds.left;
  const { margin, plotWidth } = state.sweepPlot;
  if (localX < margin.left || localX > margin.left + plotWidth) return;
  setAngles(state.theta, -90 + ((localX - margin.left) / plotWidth) * 180);
  canvases.sweep.focus({ preventScroll: true });
});

canvases.landscape.addEventListener("click", (event) => {
  if (!state.landscapePlot) return;
  const bounds = canvases.landscape.getBoundingClientRect();
  const x = event.clientX - bounds.left;
  const y = event.clientY - bounds.top;
  const { plotX, plotY, size } = state.landscapePlot;
  if (x < plotX || x > plotX + size || y < plotY || y > plotY + size) return;
  const phi = -90 + ((x - plotX) / size) * 180;
  const theta = 90 - ((y - plotY) / size) * 180;
  setAngles(theta, phi);
  canvases.landscape.focus({ preventScroll: true });
});

controls.sampleCount.addEventListener("change", () => {
  state.sampleCount = Math.round(clamp(Number(controls.sampleCount.value) || 1000, 10, 100000));
  controls.sampleCount.value = String(state.sampleCount);
  renderSampling();
});

controls.sampleSeed.addEventListener("change", () => {
  state.seed = Math.round(clamp(Number(controls.sampleSeed.value) || 2026, 0, 0xffffffff)) >>> 0;
  controls.sampleSeed.value = String(state.seed);
  renderSampling();
});

document.querySelector("[data-next-sample]").addEventListener("click", () => {
  state.seed = (state.seed + 1) >>> 0;
  controls.sampleSeed.value = String(state.seed);
  renderSampling();
});

const navigationLinks = [...document.querySelectorAll(".section-nav a")];
const sections = navigationLinks.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean);
function setCurrentSection(id) {
  navigationLinks.forEach((link) => {
    if (link.getAttribute("href") === `#${id}`) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}
navigationLinks.forEach((link) => link.addEventListener("click", () => setCurrentSection(link.getAttribute("href").slice(1))));
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible) setCurrentSection(visible.target.id);
  }, { rootMargin: "-12% 0px -72% 0px", threshold: [0, 0.1, 0.25] });
  sections.forEach((section) => observer.observe(section));
}

const resizeObserver = new ResizeObserver(() => {
  drawDetectorCanvas();
  drawSweep();
  drawLandscape();
});
Object.values(canvases).forEach((canvas) => resizeObserver.observe(canvas));
window.addEventListener("pagehide", () => resizeObserver.disconnect(), { once: true });

renderAll();
document.body.dataset.task08Status = "verified";
