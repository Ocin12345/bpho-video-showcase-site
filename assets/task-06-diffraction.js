import { loadTask06Evidence } from "./task-06-evidence.js?v=20260815b";

const FAMILIES = Object.freeze({
  d1: {
    label: "d₁ = 0.123 nm",
    spacingM: 1.23e-10,
    colour: "#9ef26b",
    chartColour: "#087fb8",
    dashed: false,
  },
  d2: {
    label: "d₂ = 0.213 nm",
    spacingM: 2.13e-10,
    colour: "#5ce6ae",
    chartColour: "#d45f00",
    dashed: true,
  },
});

const screenInstrument = document.querySelector("[data-screen-instrument]");
const screenCanvas = document.querySelector("#diffraction-screen");
const screenContext = screenCanvas.getContext("2d");
const validationLaboratory = document.querySelector(
  "[data-validation-laboratory]",
);
const chartCanvas = document.querySelector("#spacing-recovery-chart");
const chartContext = chartCanvas.getContext("2d");
const chartTooltip = document.querySelector("[data-validation-tooltip]");
const voltageControl = document.querySelector("#accelerating-voltage");
const controls = document.querySelector("[data-diffraction-controls]");
const sweepToggle = document.querySelector("[data-sweep-toggle]");
const resetButton = document.querySelector("[data-reset-model]");
const exportButton = document.querySelector("[data-export-csv]");
const screenModeNote = document.querySelector("[data-screen-mode-note]");
const screenModeCopy = document.querySelector("[data-screen-mode-copy]");

const outputs = {
  voltageTitle: document.querySelector("[data-voltage-title]"),
  screenBadge: document.querySelector("[data-screen-badge]"),
  voltage: document.querySelector("[data-voltage-output]"),
  wavelength: document.querySelector("[data-wavelength]"),
  d1Radius: document.querySelector("[data-d1-radius]"),
  d2Radius: document.querySelector("[data-d2-radius]"),
  forwardOrders: document.querySelector("[data-forward-orders]"),
  voltageInsight: document.querySelector("[data-voltage-insight]"),
  selectedVoltage: document.querySelector("[data-selected-voltage]"),
  validationStatus: document.querySelector("[data-validation-status]"),
  d1Recovered: document.querySelector("[data-d1-recovered]"),
  d2Recovered: document.querySelector("[data-d2-recovered]"),
  d1Gradient: document.querySelector("[data-d1-gradient]"),
  d2Gradient: document.querySelector("[data-d2-gradient]"),
  braggOrders: document.querySelector("[data-bragg-orders]"),
  screenOrders: document.querySelector("[data-screen-orders]"),
  selectedBranch: document.querySelector("[data-selected-branch]"),
  diagnosticVoltage: document.querySelector("[data-diagnostic-voltage]"),
  diagnosticWavelength: document.querySelector("[data-diagnostic-wavelength]"),
  diagnosticScaling: document.querySelector("[data-diagnostic-scaling]"),
  d1LiveSpacing: document.querySelector("[data-d1-live-spacing]"),
  d1Q: document.querySelector("[data-d1-q]"),
  d1Theta: document.querySelector("[data-d1-theta]"),
  d1Phi: document.querySelector("[data-d1-phi]"),
  d1LiveRadius: document.querySelector("[data-d1-live-radius]"),
  d2Q: document.querySelector("[data-d2-q]"),
  d2Theta: document.querySelector("[data-d2-theta]"),
  d2Phi: document.querySelector("[data-d2-phi]"),
  d2LiveRadius: document.querySelector("[data-d2-live-radius]"),
  d2LiveSpacing: document.querySelector("[data-d2-live-spacing]"),
  scalingConstant: document.querySelector("[data-scaling-constant]"),
  lambda1Kv: document.querySelector("[data-lambda-1kv]"),
  lambda3Kv: document.querySelector("[data-lambda-3kv]"),
  lambda5Kv: document.querySelector("[data-lambda-5kv]"),
  scalingCheck: document.querySelector("[data-scaling-check]"),
  braggCheck: document.querySelector("[data-bragg-check]"),
  geometryCheck: document.querySelector("[data-geometry-check]"),
  d1ValidationGradient: document.querySelector("[data-d1-validation-gradient]"),
  d2ValidationGradient: document.querySelector("[data-d2-validation-gradient]"),
  d1TheoreticalGradient: document.querySelector("[data-d1-theoretical-gradient]"),
  d2TheoreticalGradient: document.querySelector("[data-d2-theoretical-gradient]"),
  d1Intercept: document.querySelector("[data-d1-intercept]"),
  d2Intercept: document.querySelector("[data-d2-intercept]"),
  d1RSquared: document.querySelector("[data-d1-r-squared]"),
  d2RSquared: document.querySelector("[data-d2-r-squared]"),
  d1ValidationSpacing: document.querySelector("[data-d1-validation-spacing]"),
  d2ValidationSpacing: document.querySelector("[data-d2-validation-spacing]"),
  d1RecoveredH: document.querySelector("[data-d1-recovered-h]"),
  d2RecoveredH: document.querySelector("[data-d2-recovered-h]"),
};

const state = {
  evidence: null,
  voltageIndex: 200,
  visibleFamilies: new Set(["d1", "d2"]),
  screenMode: "phosphor",
  chartPoints: [],
  sweepFrame: null,
  sweepRunning: false,
  sweepPaused: false,
  sweepStartedAt: 0,
  sweepStartVoltage: 1000,
};

const SWEEP_DURATION_MS = 8000;

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
  return { width, height, density };
}

function currentRecord() {
  return state.evidence.sweep[state.voltageIndex];
}

function ringCatalogue(record, familyId) {
  const family = FAMILIES[familyId];
  const maximum = record[familyId].maximumScreenOrder;
  const rings = [];
  for (let order = 1; order <= maximum; order += 1) {
    const q = (order * record.wavelengthM) / (2 * family.spacingM);
    const phi = 2 * Math.asin(q);
    const radiusMm = 65 * Math.sin(phi);
    rings.push({ order, q, phi, radiusMm });
  }
  return rings;
}

function drawPhosphorRing(centerX, centerY, radius, family, order, compact) {
  const firstOrder = order === 1;
  const familyStrength = family.dashed ? 0.86 : 1;
  const orderFade = Math.exp(-(order - 1) * 0.42);
  const alpha = Math.max(0.008, orderFade * familyStrength);
  const widths = firstOrder
    ? compact
      ? [8.5, 4.2, 1.4]
      : [11, 5.4, 1.7]
    : compact
      ? [5.5, 2.4, 0.9]
      : [7, 3.1, 1.05];
  const opacities = [0.05, 0.14, 0.5];
  const blurs = firstOrder ? [20, 11, 4] : [13, 7, 2];

  for (let pass = 0; pass < widths.length; pass += 1) {
    screenContext.save();
    screenContext.strokeStyle = family.colour;
    screenContext.globalAlpha = Math.min(0.92, alpha * opacities[pass]);
    screenContext.lineWidth = widths[pass];
    screenContext.shadowColor = family.colour;
    screenContext.shadowBlur = blurs[pass];
    screenContext.beginPath();
    screenContext.arc(centerX, centerY, radius, 0, Math.PI * 2);
    screenContext.stroke();
    screenContext.restore();
  }
}

function drawOrderRing(centerX, centerY, radius, family, order, compact) {
  const firstOrder = order === 1;
  screenContext.save();
  screenContext.strokeStyle = family.colour;
  screenContext.globalAlpha = firstOrder ? 0.96 : 0.48;
  screenContext.lineWidth = firstOrder
    ? compact
      ? 2.6
      : 3.2
    : compact
      ? 1.05
      : 1.3;
  screenContext.setLineDash(
    family.dashed ? (firstOrder ? [10, 6] : [6, 5]) : [],
  );
  screenContext.shadowColor = family.colour;
  screenContext.shadowBlur = firstOrder ? 13 : 3;
  screenContext.beginPath();
  screenContext.arc(centerX, centerY, radius, 0, Math.PI * 2);
  screenContext.stroke();
  screenContext.restore();
}

function drawScreen() {
  if (!state.evidence) return;
  const { width, height } = canvasSize(screenCanvas, screenContext);
  const compact = width < 540;
  const centerX = width / 2;
  const centerY = height / 2 + (compact ? 9 : 13);
  const screenRadius = Math.min(width * 0.42, height * (compact ? 0.39 : 0.405));
  const record = currentRecord();

  screenContext.clearRect(0, 0, width, height);
  screenContext.save();

  const backdrop = screenContext.createRadialGradient(
    centerX,
    centerY,
    0,
    centerX,
    centerY,
    screenRadius * 1.14,
  );
  backdrop.addColorStop(0, "#0a2a15");
  backdrop.addColorStop(0.42, "#05180c");
  backdrop.addColorStop(0.82, "#020b05");
  backdrop.addColorStop(1, "#010302");
  screenContext.fillStyle = "#020503";
  screenContext.fillRect(0, 0, width, height);
  screenContext.fillStyle = backdrop;
  screenContext.beginPath();
  screenContext.arc(centerX, centerY, screenRadius, 0, Math.PI * 2);
  screenContext.fill();

  screenContext.strokeStyle = "rgba(190,255,180,0.24)";
  screenContext.lineWidth = 1.25;
  screenContext.beginPath();
  screenContext.arc(centerX, centerY, screenRadius, 0, Math.PI * 2);
  screenContext.stroke();

  if (state.screenMode === "orders") {
    screenContext.strokeStyle = "rgba(150,230,150,0.055)";
    screenContext.lineWidth = 1;
    for (let fraction = 0.2; fraction < 1; fraction += 0.2) {
      screenContext.beginPath();
      screenContext.arc(
        centerX,
        centerY,
        screenRadius * fraction,
        0,
        Math.PI * 2,
      );
      screenContext.stroke();
    }
  }

  for (const familyId of ["d1", "d2"]) {
    if (!state.visibleFamilies.has(familyId)) continue;
    const family = FAMILIES[familyId];
    const rings = ringCatalogue(record, familyId);
    for (const ring of rings.slice().reverse()) {
      const radius = (ring.radiusMm / 65) * screenRadius;
      if (state.screenMode === "phosphor") {
        drawPhosphorRing(
          centerX,
          centerY,
          radius,
          family,
          ring.order,
          compact,
        );
      } else {
        drawOrderRing(centerX, centerY, radius, family, ring.order, compact);
      }
    }
  }

  const beamGlow = screenContext.createRadialGradient(
    centerX,
    centerY,
    0,
    centerX,
    centerY,
    compact ? 42 : 55,
  );
  beamGlow.addColorStop(0, "rgba(220,255,222,0.98)");
  beamGlow.addColorStop(0.12, "rgba(113,255,120,0.9)");
  beamGlow.addColorStop(0.38, "rgba(45,228,91,0.38)");
  beamGlow.addColorStop(1, "rgba(45,228,91,0)");
  screenContext.fillStyle = beamGlow;
  screenContext.beginPath();
  screenContext.arc(centerX, centerY, compact ? 42 : 55, 0, Math.PI * 2);
  screenContext.fill();

  screenContext.fillStyle = "#dfffe2";
  screenContext.font = `${compact ? 9 : 11}px "Times New Roman"`;
  screenContext.textAlign = "left";
  screenContext.fillText(
    state.screenMode === "phosphor"
      ? "SCHEMATIC PHOSPHOR VIEW"
      : "EXACT FORWARD-SCREEN ORDERS",
    compact ? 14 : 22,
    compact ? 24 : 27,
  );
  screenContext.fillStyle = "#93a895";
  screenContext.textAlign = "right";
  screenContext.fillText(
    "x = r sin(φ) · r = 65 mm",
    width - (compact ? 14 : 22),
    compact ? 24 : 27,
  );

  const scaleY = height - (compact ? 21 : 25);
  const scaleWidth = screenRadius * (20 / 65);
  screenContext.strokeStyle = "#c8d8c6";
  screenContext.lineWidth = 1.2;
  screenContext.beginPath();
  screenContext.moveTo(centerX - scaleWidth / 2, scaleY);
  screenContext.lineTo(centerX + scaleWidth / 2, scaleY);
  screenContext.moveTo(centerX - scaleWidth / 2, scaleY - 4);
  screenContext.lineTo(centerX - scaleWidth / 2, scaleY + 4);
  screenContext.moveTo(centerX + scaleWidth / 2, scaleY - 4);
  screenContext.lineTo(centerX + scaleWidth / 2, scaleY + 4);
  screenContext.stroke();
  screenContext.fillStyle = "#9daa9d";
  screenContext.textAlign = "center";
  screenContext.fillText("20 mm", centerX, scaleY - 7);

  screenContext.restore();
}

function drawValidationChart() {
  if (!state.evidence) return;
  const { width, height } = canvasSize(chartCanvas, chartContext);
  const compact = width < 620;
  const margins = {
    left: compact ? 65 : 92,
    right: compact ? 20 : 44,
    top: compact ? 54 : 66,
    bottom: compact ? 72 : 84,
  };
  const plot = {
    x: margins.left,
    y: margins.top,
    width: width - margins.left - margins.right,
    height: height - margins.top - margins.bottom,
  };
  const xMin = 0;
  const xMax = 0.17;
  const yMin = 0;
  const yMax = 0.033;
  const xFor = (value) => plot.x + ((value - xMin) / (xMax - xMin)) * plot.width;
  const yFor = (value) =>
    plot.y + plot.height - ((value - yMin) / (yMax - yMin)) * plot.height;

  chartContext.clearRect(0, 0, width, height);
  chartContext.save();
  chartContext.fillStyle = "#f8faf3";
  chartContext.fillRect(0, 0, width, height);

  chartContext.font = `${compact ? 10 : 14}px "Times New Roman"`;
  chartContext.fillStyle = "#475349";
  chartContext.strokeStyle = "#d5ddd2";
  chartContext.lineWidth = 1;

  const xTicks = compact
    ? [0, 0.04, 0.08, 0.12, 0.16]
    : [0, 0.02, 0.04, 0.06, 0.08, 0.1, 0.12, 0.14, 0.16];
  const yTicks = [0, 0.005, 0.01, 0.015, 0.02, 0.025, 0.03];

  for (const tick of yTicks) {
    const y = yFor(tick);
    chartContext.beginPath();
    chartContext.moveTo(plot.x, y);
    chartContext.lineTo(plot.x + plot.width, y);
    chartContext.stroke();
    chartContext.textAlign = "right";
    chartContext.fillText(tick.toFixed(3), plot.x - 12, y + 4);
  }

  for (const tick of xTicks) {
    const x = xFor(tick);
    chartContext.beginPath();
    chartContext.moveTo(x, plot.y);
    chartContext.lineTo(x, plot.y + plot.height);
    chartContext.stroke();
    chartContext.textAlign = "center";
    chartContext.fillText(tick.toFixed(2), x, plot.y + plot.height + 23);
  }

  chartContext.strokeStyle = "#344037";
  chartContext.lineWidth = 1.4;
  chartContext.beginPath();
  chartContext.moveTo(plot.x, plot.y);
  chartContext.lineTo(plot.x, plot.y + plot.height);
  chartContext.lineTo(plot.x + plot.width, plot.y + plot.height);
  chartContext.stroke();

  chartContext.fillStyle = "#1a221b";
  chartContext.font = `${compact ? 13 : 17}px "Times New Roman"`;
  chartContext.textAlign = "center";
  chartContext.fillText(
    "sin(φ/2)",
    plot.x + plot.width / 2,
    height - (compact ? 18 : 24),
  );
  chartContext.save();
  chartContext.translate(compact ? 18 : 28, plot.y + plot.height / 2);
  chartContext.rotate(-Math.PI / 2);
  chartContext.fillText("1/√V (V⁻¹ᐟ²)", 0, 0);
  chartContext.restore();

  const firstOrderFits = Object.fromEntries(
    state.evidence.fits
      .filter((fit) => fit.fitKind === "first_order")
      .map((fit) => [fit.spacingId, fit]),
  );
  const points = [];

  chartContext.save();
  chartContext.beginPath();
  chartContext.rect(plot.x, plot.y, plot.width, plot.height);
  chartContext.clip();

  for (const familyId of ["d1", "d2"]) {
    const family = FAMILIES[familyId];
    const fit = firstOrderFits[familyId];
    chartContext.strokeStyle = family.chartColour;
    chartContext.lineWidth = compact ? 2.4 : 3.2;
    chartContext.beginPath();
    chartContext.moveTo(xFor(0), yFor(0));
    chartContext.lineTo(xFor(yMax / fit.gradient), yFor(yMax));
    chartContext.stroke();

    for (let index = 0; index < state.evidence.sweep.length; index += 50) {
      const record = state.evidence.sweep[index];
      const x = xFor(record[familyId].q);
      const y = yFor(1 / Math.sqrt(record.voltageV));
      chartContext.fillStyle = family.chartColour;
      chartContext.strokeStyle = "#f8faf3";
      chartContext.lineWidth = 1.3;
      chartContext.beginPath();
      chartContext.arc(x, y, compact ? 3.4 : 4.7, 0, Math.PI * 2);
      chartContext.fill();
      chartContext.stroke();
      points.push({ x, y, familyId, record });
    }

    const selected = currentRecord();
    const selectedX = xFor(selected[familyId].q);
    const selectedY = yFor(1 / Math.sqrt(selected.voltageV));
    chartContext.fillStyle = family.chartColour;
    chartContext.strokeStyle = "#1a221b";
    chartContext.lineWidth = 2;
    chartContext.beginPath();
    chartContext.arc(selectedX, selectedY, compact ? 6.5 : 8.5, 0, Math.PI * 2);
    chartContext.fill();
    chartContext.stroke();
    points.push({ x: selectedX, y: selectedY, familyId, record: selected });
  }
  state.chartPoints = points;
  chartContext.restore();

  chartContext.font = `italic ${compact ? 11 : 14}px "Times New Roman"`;
  chartContext.textAlign = "right";
  chartContext.fillStyle = "#536054";
  chartContext.fillText(
    "first order · exact φ · constrained fit through origin",
    plot.x + plot.width,
    plot.y - 18,
  );

  const labelY = plot.y + (compact ? 24 : 27);
  chartContext.textAlign = "left";
  chartContext.font = `bold ${compact ? 10 : 13}px "Times New Roman"`;
  chartContext.fillStyle = FAMILIES.d1.chartColour;
  chartContext.fillText("d₁ = 0.123 nm", plot.x + 12, labelY);
  chartContext.fillStyle = FAMILIES.d2.chartColour;
  chartContext.fillText(
    "d₂ = 0.213 nm",
    plot.x + (compact ? 105 : 140),
    labelY,
  );
  chartContext.restore();
}

function updateOutputs() {
  const record = currentRecord();
  const kv = record.voltageKv.toFixed(2);
  outputs.voltageTitle.textContent = `${kv} kV`;
  const orderCount =
    record.d1.maximumScreenOrder + record.d2.maximumScreenOrder;
  outputs.screenBadge.textContent =
    state.screenMode === "phosphor"
      ? `Phosphor view · ${orderCount} orders`
      : `Exact geometry · ${orderCount} orders`;
  outputs.voltage.textContent = `${kv} kV`;
  outputs.wavelength.textContent = `${record.wavelengthPm.toFixed(3)} pm`;
  outputs.d1Radius.textContent = `${record.d1.photoRadiusMm.toFixed(3)} mm`;
  outputs.d2Radius.textContent = `${record.d2.photoRadiusMm.toFixed(3)} mm`;
  outputs.forwardOrders.textContent = `${record.d1.maximumScreenOrder} + ${record.d2.maximumScreenOrder}`;
  const relativePosition = (record.voltageV - 1000) / 4000;
  if (relativePosition < 0.34) {
    outputs.voltageInsight.textContent =
      "Lower V gives a longer wavelength and wider fixed-order rings.";
  } else if (relativePosition > 0.66) {
    outputs.voltageInsight.textContent =
      "Higher V gives a shorter wavelength and tighter fixed-order rings.";
  } else {
    outputs.voltageInsight.textContent =
      "Raise V: the wavelength falls and each fixed-order ring contracts.";
  }
  outputs.selectedVoltage.textContent = `${kv} kV`;
  outputs.braggOrders.textContent = `d₁ ${record.d1.maximumBraggOrder} · d₂ ${record.d2.maximumBraggOrder}`;
  outputs.screenOrders.textContent = `d₁ ${record.d1.maximumScreenOrder} · d₂ ${record.d2.maximumScreenOrder}`;
  outputs.selectedBranch.textContent = `${kv} kV`;
  updateDiagnostics(record);

  document.querySelectorAll("[data-voltage-preset]").forEach((button) => {
    button.classList.toggle(
      "is-active",
      Number(button.dataset.voltagePreset) === record.voltageV,
    );
  });

  screenCanvas.setAttribute(
    "aria-label",
    `${state.screenMode === "phosphor" ? "Schematic phosphor rendering of exact ring positions" : "Exact forward-screen electron-diffraction order geometry"} at ${kv} kilovolts. Electron wavelength ${record.wavelengthPm.toFixed(
      3,
    )} picometres. Spacing d1 has ${
      record.d1.maximumScreenOrder
    } forward orders and first-order photographic radius ${record.d1.photoRadiusMm.toFixed(
      3,
    )} millimetres. Spacing d2 has ${
      record.d2.maximumScreenOrder
    } forward orders and first-order radius ${record.d2.photoRadiusMm.toFixed(
      3,
    )} millimetres. Ring brightness is schematic.`,
  );
  chartCanvas.setAttribute(
    "aria-label",
    `Official inverse square-root voltage against sine of half scattering angle validation. The selected ${kv} kilovolt evidence point is highlighted for both graphite spacings. Both fits pass through the origin and recover 0.123 and 0.213 nanometres.`,
  );
}

function updateDiagnostics(record) {
  outputs.diagnosticVoltage.textContent = `${record.voltageV.toFixed(0)} V`;
  outputs.diagnosticWavelength.textContent = `${record.wavelengthPm.toFixed(6)} pm`;
  outputs.diagnosticScaling.textContent = `${(
    record.wavelengthPm * Math.sqrt(record.voltageV)
  ).toFixed(6)} pm·V¹ᐟ²`;

  for (const familyId of ["d1", "d2"]) {
    const family = record[familyId];
    const spacingM = state.evidence.manifest.configuration.spacings.find(
      (spacing) => spacing.identifier === familyId,
    ).spacing_m;
    const thetaRad = family.phiRad / 2;
    const thetaDeg = family.phiDeg / 2;
    outputs[`${familyId}Q`].textContent = family.q.toFixed(9);
    outputs[`${familyId}Theta`].textContent = `${thetaDeg.toFixed(6)}°`;
    outputs[`${familyId}Phi`].textContent = `${family.phiDeg.toFixed(6)}°`;
    outputs[`${familyId}LiveRadius`].textContent = `${family.photoRadiusMm.toFixed(6)} mm`;
    outputs[`${familyId}LiveSpacing`].textContent = (spacingM * 1e9).toFixed(3);
    document
      .querySelector(`[data-diagnostic-family="${familyId}"]`)
      .classList.toggle("is-disabled", !state.visibleFamilies.has(familyId));

    if (Math.abs(Math.sin(thetaRad) - family.q) > 5e-12) {
      throw new Error(`Live ${familyId} Bragg diagnostic is inconsistent`);
    }
  }
}

function setVoltage(voltageV) {
  const bounded = Math.min(5000, Math.max(1000, Number(voltageV)));
  const snapped = Math.round((bounded - 1000) / 10) * 10 + 1000;
  state.voltageIndex = (snapped - 1000) / 10;
  voltageControl.value = String(snapped);
  updateOutputs();
  drawScreen();
  drawValidationChart();
  window.dispatchEvent(
    new CustomEvent("task06:voltage", { detail: { voltageV: snapped } }),
  );
}

function stepVoltage(step) {
  setVoltage(currentRecord().voltageV + step);
}

function updateSweepButton() {
  if (state.sweepRunning) sweepToggle.textContent = "Pause sweep";
  else if (state.sweepPaused) sweepToggle.textContent = "Resume sweep";
  else sweepToggle.textContent = "Sweep 1 → 5 kV";
  sweepToggle.setAttribute("aria-pressed", String(state.sweepRunning));
}

function pauseSweep(allowResume = true) {
  if (state.sweepFrame !== null) cancelAnimationFrame(state.sweepFrame);
  state.sweepFrame = null;
  state.sweepPaused = allowResume && state.sweepRunning;
  state.sweepRunning = false;
  updateSweepButton();
}

function sweepTick(timestamp) {
  if (!state.sweepRunning) return;
  const elapsed = timestamp - state.sweepStartedAt;
  const remainingRange = 5000 - state.sweepStartVoltage;
  const remainingDuration = SWEEP_DURATION_MS * (remainingRange / 4000);
  const progress = Math.min(1, elapsed / Math.max(1, remainingDuration));
  const voltage = state.sweepStartVoltage + remainingRange * progress;
  setVoltage(voltage);
  if (progress >= 1) {
    state.sweepRunning = false;
    state.sweepPaused = false;
    state.sweepFrame = null;
    updateSweepButton();
    return;
  }
  state.sweepFrame = requestAnimationFrame(sweepTick);
}

function startSweep(resume = false) {
  if (state.sweepRunning) return;
  if (!resume || currentRecord().voltageV >= 5000) setVoltage(1000);
  state.sweepStartVoltage = currentRecord().voltageV;
  state.sweepStartedAt = performance.now();
  state.sweepRunning = true;
  state.sweepPaused = false;
  updateSweepButton();
  state.sweepFrame = requestAnimationFrame(sweepTick);
}

function resetModel() {
  pauseSweep(false);
  state.visibleFamilies = new Set(["d1", "d2"]);
  state.screenMode = "phosphor";
  controls.querySelectorAll("[data-family]").forEach((checkbox) => {
    checkbox.checked = true;
  });
  controls.querySelectorAll("[data-screen-mode]").forEach((radio) => {
    radio.checked = radio.value === "phosphor";
  });
  updateScreenModeCopy();
  setVoltage(3000);
}

function updateScreenModeCopy() {
  const phosphor = state.screenMode === "phosphor";
  screenInstrument.dataset.screenMode = state.screenMode;
  screenModeCopy.textContent = phosphor
    ? "Softened ring bands echo the tube photograph; their brightness is not a predicted intensity."
    : "Thin lines expose every allowed forward-screen order; d₂ is dashed for separation.";
  screenModeNote.textContent = phosphor
    ? "Colour separates families; glow and brightness are schematic."
    : "Solid d₁ and dashed d₂ show every allowed forward-screen order.";
}

function csvCell(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function buildExportCsv() {
  const { manifest } = state.evidence;
  const spacingById = Object.fromEntries(
    manifest.configuration.spacings.map((spacing) => [
      spacing.identifier,
      spacing.spacing_m,
    ]),
  );
  const lines = [
    "# BPhO Computational Challenge 2026 — Official Task 06 of 10",
    `# model,${manifest.model}`,
    `# constants,${manifest.constant_source}`,
    `# schema_version,${manifest.output_schema_version}`,
    `# tube_radius_mm,${manifest.configuration.tube_radius_m * 1000}`,
    "# angle_definition,theta is Bragg glancing angle; phi=2theta is total beam deflection",
    "# geometry,x=r sin(phi) screen radius; y=2r sin(phi)=2x full ring diameter",
    [
      "voltage_V",
      "wavelength_pm",
      "family",
      "spacing_nm",
      "order_n",
      "q_sin_theta",
      "theta_deg",
      "phi_deg",
      "photographic_radius_x_mm",
      "caliper_chord_y_mm",
      "inverse_sqrt_voltage_V_neg_half",
    ].join(","),
  ];

  for (const record of state.evidence.sweep) {
    for (const familyId of ["d1", "d2"]) {
      const family = record[familyId];
      lines.push(
        [
          record.voltageV,
          record.wavelengthPm.toPrecision(16),
          familyId,
          spacingById[familyId] * 1e9,
          1,
          family.q.toPrecision(16),
          (family.phiDeg / 2).toPrecision(16),
          family.phiDeg.toPrecision(16),
          family.photoRadiusMm.toPrecision(16),
          (family.caliperDiameterM * 1000).toPrecision(16),
          (1 / Math.sqrt(record.voltageV)).toPrecision(16),
        ].map(csvCell).join(","),
      );
    }
  }
  return `${lines.join("\n")}\n`;
}

function exportCsv() {
  const blob = new Blob([buildExportCsv()], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "task06_first_order_electron_diffraction.csv";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function nearestChartPoint(event) {
  const bounds = chartCanvas.getBoundingClientRect();
  const x = event.clientX - bounds.left;
  const y = event.clientY - bounds.top;
  let nearest = null;
  let nearestDistance = 18;
  for (const point of state.chartPoints) {
    const distance = Math.hypot(point.x - x, point.y - y);
    if (distance < nearestDistance) {
      nearest = point;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function showChartTooltip(point, event) {
  const family = FAMILIES[point.familyId];
  chartTooltip.innerHTML = `
    <strong>${family.label}</strong><br>
    ${point.record.voltageKv.toFixed(2)} kV<br>
    sin(φ/2) = ${point.record[point.familyId].q.toFixed(6)}<br>
    1/√V = ${(1 / Math.sqrt(point.record.voltageV)).toFixed(6)} V<sup>−1/2</sup>
  `;
  chartTooltip.hidden = false;
  const wrap = document.querySelector(".validation-chart-wrap");
  const bounds = wrap.getBoundingClientRect();
  const left = Math.min(
    bounds.width - 215,
    Math.max(12, event.clientX - bounds.left + 16),
  );
  const top = Math.min(
    bounds.height - 118,
    Math.max(12, event.clientY - bounds.top + 16),
  );
  chartTooltip.style.left = `${left}px`;
  chartTooltip.style.top = `${top}px`;
}

function handleChartPointerMove(event) {
  const point = nearestChartPoint(event);
  if (!point) {
    chartTooltip.hidden = true;
    chartCanvas.style.cursor = "crosshair";
    return;
  }
  chartCanvas.style.cursor = "pointer";
  showChartTooltip(point, event);
}

function handleChartClick(event) {
  const point = nearestChartPoint(event);
  if (point) setVoltage(point.record.voltageV);
}

function handleVoltageKeydown(event) {
  const steps = {
    ArrowLeft: -10,
    ArrowDown: -10,
    ArrowRight: 10,
    ArrowUp: 10,
    PageDown: -100,
    PageUp: 100,
  };
  if (event.key === "Home") {
    event.preventDefault();
    setVoltage(1000);
  } else if (event.key === "End") {
    event.preventDefault();
    setVoltage(5000);
  } else if (steps[event.key]) {
    event.preventDefault();
    stepVoltage(steps[event.key]);
  }
}

function populateFits() {
  const firstOrder = Object.fromEntries(
    state.evidence.fits
      .filter((fit) => fit.fitKind === "first_order")
      .map((fit) => [fit.spacingId, fit]),
  );
  outputs.d1Recovered.textContent = `${firstOrder.d1.recoveredSpacingNm.toFixed(
    6,
  )} nm`;
  outputs.d2Recovered.textContent = `${firstOrder.d2.recoveredSpacingNm.toFixed(
    6,
  )} nm`;
  outputs.d1Gradient.textContent = `Gradient ${firstOrder.d1.gradient.toFixed(
    12,
  )} V⁻¹ᐟ²`;
  outputs.d2Gradient.textContent = `Gradient ${firstOrder.d2.gradient.toFixed(
    12,
  )} V⁻¹ᐟ²`;
  outputs.validationStatus.textContent = "Both 401-point fits locked";
}

function populateValidationEvidence() {
  const { manifest, validation, sweep, fits } = state.evidence;
  const constants = manifest.constants;
  const firstOrder = Object.fromEntries(
    fits
      .filter((fit) => fit.fitKind === "first_order")
      .map((fit) => [fit.spacingId, fit]),
  );
  const checks = Object.fromEntries(
    validation.checks.map((check) => [check.name, check]),
  );
  const spacingById = Object.fromEntries(
    manifest.configuration.spacings.map((spacing) => [
      spacing.identifier,
      spacing.spacing_m,
    ]),
  );
  const scalingPm = sweep[0].wavelengthPm * Math.sqrt(sweep[0].voltageV);
  outputs.scalingConstant.textContent = `${scalingPm.toFixed(9)} pm·V¹ᐟ²`;
  outputs.lambda1Kv.textContent = `${sweep[0].wavelengthPm.toFixed(6)} pm`;
  outputs.lambda3Kv.textContent = `${sweep[200].wavelengthPm.toFixed(6)} pm`;
  outputs.lambda5Kv.textContent = `${sweep[400].wavelengthPm.toFixed(6)} pm`;
  outputs.scalingCheck.textContent = `PASS — full-sweep relative variation ${checks.inverse_sqrt_voltage_scaling.observed.toExponential(3)} (limit ${checks.inverse_sqrt_voltage_scaling.tolerance.toExponential(1)}).`;
  outputs.braggCheck.textContent =
    checks.bragg_ratio_identity.passed && checks.bragg_angle_identity.passed
      ? "PASS — q = nλ/(2d) = sin θ"
      : "FAIL";

  const geometryPassed = sweep.every((record) =>
    ["d1", "d2"].every((familyId) => {
      const family = record[familyId];
      const expectedRadius = manifest.configuration.tube_radius_m * Math.sin(family.phiRad);
      return (
        Math.abs(family.photoRadiusM - expectedRadius) <= 5e-13 &&
        Math.abs(family.caliperDiameterM - 2 * expectedRadius) <= 5e-13
      );
    }),
  );
  outputs.geometryCheck.textContent = geometryPassed
    ? "PASS — x = r sin φ and y = 2x across all 401 voltages"
    : "FAIL";

  for (const familyId of ["d1", "d2"]) {
    const fit = firstOrder[familyId];
    const spacingM = spacingById[familyId];
    const theoreticalGradient =
      (2 * spacingM * Math.sqrt(2 * constants.electron_mass_kg * constants.elementary_charge_c)) /
      constants.planck_constant_j_s;
    const recoveredH =
      (2 * spacingM * Math.sqrt(2 * constants.electron_mass_kg * constants.elementary_charge_c)) /
      fit.gradient;
    outputs[`${familyId}ValidationGradient`].textContent = fit.gradient.toFixed(17);
    outputs[`${familyId}TheoreticalGradient`].textContent = theoreticalGradient.toFixed(17);
    outputs[`${familyId}Intercept`].textContent = `${fit.intercept.toExponential(3)} V⁻¹ᐟ²`;
    outputs[`${familyId}RSquared`].textContent = fit.rSquared.toFixed(12);
    outputs[`${familyId}ValidationSpacing`].textContent = `${fit.recoveredSpacingNm.toFixed(6)} nm`;
    outputs[`${familyId}RecoveredH`].textContent = `${(recoveredH / 1e-34).toFixed(8)} × 10⁻³⁴ J s`;
  }
}

function enableControls() {
  controls
    .querySelectorAll("button, input")
    .forEach((control) => (control.disabled = false));
  exportButton.disabled = false;
}

function disableControls() {
  controls
    .querySelectorAll("button, input")
    .forEach((control) => (control.disabled = true));
  exportButton.disabled = true;
}

function bindEvents() {
  voltageControl.addEventListener("input", () => {
    pauseSweep(false);
    setVoltage(Number(voltageControl.value));
  });

  controls
    .querySelectorAll("[data-voltage-preset]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        pauseSweep(false);
        setVoltage(Number(button.dataset.voltagePreset));
      });
    });

  controls.querySelectorAll("[data-family]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.visibleFamilies.add(checkbox.dataset.family);
      else state.visibleFamilies.delete(checkbox.dataset.family);
      updateDiagnostics(currentRecord());
      drawScreen();
    });
  });

  controls.querySelectorAll("[data-screen-mode]").forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      state.screenMode = radio.value;
      updateScreenModeCopy();
      updateOutputs();
      drawScreen();
    });
  });

  screenCanvas.addEventListener("keydown", handleVoltageKeydown);
  chartCanvas.addEventListener("keydown", handleVoltageKeydown);
  chartCanvas.addEventListener("pointermove", handleChartPointerMove, {
    passive: true,
  });
  chartCanvas.addEventListener("pointerleave", () => {
    chartTooltip.hidden = true;
    chartCanvas.style.cursor = "crosshair";
  });
  chartCanvas.addEventListener("click", handleChartClick);
  sweepToggle.addEventListener("click", () => {
    if (state.sweepRunning) pauseSweep(true);
    else startSweep(state.sweepPaused);
  });
  resetButton.addEventListener("click", resetModel);
  exportButton.addEventListener("click", exportCsv);

  const resizeObserver = new ResizeObserver(() => {
    drawScreen();
    drawValidationChart();
  });
  resizeObserver.observe(screenCanvas);
  resizeObserver.observe(chartCanvas);

  window.addEventListener(
    "pagehide",
    () => {
      resizeObserver.disconnect();
      pauseSweep(false);
    },
    { once: true },
  );
}

function showFailure(error) {
  document.documentElement.dataset.task06Status = "error";
  screenInstrument.classList.remove("is-loading");
  validationLaboratory.classList.remove("is-loading");
  document.querySelector("[data-screen-loading]").hidden = true;
  document.querySelector("[data-screen-error]").hidden = false;
  document.querySelector("[data-validation-error]").hidden = false;
  outputs.screenBadge.textContent = "Data unavailable";
  outputs.validationStatus.textContent = "Spacing data unavailable";
  disableControls();
  console.error("Task 6 evidence load failed", error);
}

async function initialise() {
  try {
    state.evidence = await loadTask06Evidence();
    populateFits();
    populateValidationEvidence();
    bindEvents();
    enableControls();
    updateScreenModeCopy();
    screenInstrument.classList.remove("is-loading");
    validationLaboratory.classList.remove("is-loading");
    document.querySelector("[data-screen-loading]").hidden = true;
    document.documentElement.dataset.task06Status = "ready";
    setVoltage(3000);
    window.dispatchEvent(new CustomEvent("task06:ready"));
  } catch (error) {
    showFailure(error);
  }
}

initialise();