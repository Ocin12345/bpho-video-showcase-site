const EVIDENCE_URL = new URL(
  "../data/task06/relativistic_extension.json",
  import.meta.url,
);

const CONSTANTS = Object.freeze({
  h: 6.62607015e-34,
  e: 1.602176634e-19,
  m: 9.1093837139e-31,
  c: 299792458,
  r: 0.065,
});

const SPACINGS = Object.freeze({ d1: 0.123e-9, d2: 0.213e-9 });
const SERIES = Object.freeze({
  d1: { colour: "#1769b0", dashed: false },
  d2: { colour: "#0f4f87", dashed: true },
});

const section = document.querySelector("[data-relativity-extension]");
const disclosure = document.querySelector("[data-advanced-disclosure]");
const canvas = document.querySelector("#relativity-chart");
const context = canvas.getContext("2d");
const voltageControl = document.querySelector("#accelerating-voltage");

const outputs = {
  voltage: document.querySelector("[data-relativity-voltage]"),
  status: document.querySelector("[data-extension-status]"),
  nonrelWavelength: document.querySelector("[data-nonrel-wavelength]"),
  relWavelength: document.querySelector("[data-rel-wavelength]"),
  correction: document.querySelector("[data-wavelength-correction]"),
  d1Nonrel: document.querySelector("[data-d1-nonrel-radius]"),
  d1Rel: document.querySelector("[data-d1-rel-radius]"),
  d1Shift: document.querySelector("[data-d1-shift]"),
  d2Nonrel: document.querySelector("[data-d2-nonrel-radius]"),
  d2Rel: document.querySelector("[data-d2-rel-radius]"),
  d2Shift: document.querySelector("[data-d2-shift]"),
  conclusion: document.querySelector("[data-extension-conclusion]"),
};

const state = {
  evidence: null,
  voltageIndex: 200,
  resizeObserver: null,
};

function relativeError(observed, expected) {
  return Math.abs(observed - expected) / Math.abs(expected);
}

function wavelengthNonrelM(voltageV) {
  return CONSTANTS.h / Math.sqrt(2 * CONSTANTS.m * CONSTANTS.e * voltageV);
}

function wavelengthRelM(voltageV) {
  const kinetic = CONSTANTS.e * voltageV;
  return (
    (CONSTANTS.h * CONSTANTS.c) /
    Math.sqrt(
      kinetic * (kinetic + 2 * CONSTANTS.m * CONSTANTS.c ** 2),
    )
  );
}

function firstOrderRadiusM(wavelengthM, spacingM) {
  const q = wavelengthM / (2 * spacingM);
  const theta = Math.asin(q);
  const phi = 2 * theta;
  return CONSTANTS.r * Math.sin(phi);
}

function validateEvidence(evidence) {
  if (
    evidence?.schema_version !== "task06-relativistic-extension-v1" ||
    evidence?.status !==
      "secondary precision extension; official baseline preserved" ||
    evidence?.validation?.passed !== true ||
    evidence?.validation?.check_count !== 10 ||
    !evidence.validation.checks.every((check) => check.passed === true) ||
    !Array.isArray(evidence.records) ||
    evidence.records.length !== 401
  ) {
    throw new Error("Unsupported Task 6 extension evidence");
  }

  evidence.records.forEach((record, index) => {
    const expectedVoltage = 1000 + index * 10;
    const nonrelM = wavelengthNonrelM(expectedVoltage);
    const relM = wavelengthRelM(expectedVoltage);
    if (
      record.voltage_v !== expectedVoltage ||
      record.voltage_kv !== expectedVoltage / 1000 ||
      relativeError(record.wavelength_nonrel_pm * 1e-12, nonrelM) > 5e-13 ||
      relativeError(record.wavelength_rel_pm * 1e-12, relM) > 5e-13 ||
      Math.abs(
        record.wavelength_correction_percent -
          100 * (relM / nonrelM - 1),
      ) > 5e-12 ||
      record.wavelength_correction_percent >= 0
    ) {
      throw new Error(`Invalid extension wavelength row ${index + 1}`);
    }

    for (const familyId of ["d1", "d2"]) {
      const family = record[familyId];
      const expectedNonrel = firstOrderRadiusM(nonrelM, SPACINGS[familyId]);
      const expectedRel = firstOrderRadiusM(relM, SPACINGS[familyId]);
      if (
        !family ||
        relativeError(family.radius_nonrel_mm * 1e-3, expectedNonrel) > 5e-13 ||
        relativeError(family.radius_rel_mm * 1e-3, expectedRel) > 5e-13 ||
        Math.abs(
          family.radius_shift_um - (expectedRel - expectedNonrel) * 1e6,
        ) > 5e-10 ||
        family.radius_shift_um >= 0
      ) {
        throw new Error(`Invalid ${familyId} extension geometry at ${expectedVoltage} V`);
      }
      Object.freeze(family);
    }
    Object.freeze(record);
  });
  return Object.freeze(evidence);
}

function canvasSize() {
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

function drawChart() {
  if (!state.evidence) return;
  const { width, height } = canvasSize();
  const compact = width < 620;
  const margins = {
    left: compact ? 58 : 82,
    right: compact ? 18 : 34,
    top: compact ? 46 : 58,
    bottom: compact ? 62 : 76,
  };
  const plot = {
    x: margins.left,
    y: margins.top,
    width: width - margins.left - margins.right,
    height: height - margins.top - margins.bottom,
  };
  const xFor = (voltageKv) => plot.x + ((voltageKv - 1) / 4) * plot.width;
  const yMin = -50;
  const yFor = (shiftUm) => plot.y + ((0 - shiftUm) / (0 - yMin)) * plot.height;

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.font = `${compact ? 10 : 13}px "Times New Roman"`;
  context.fillStyle = "#5f5a52";
  context.strokeStyle = "#e3dfd7";
  context.lineWidth = 1;

  for (const tick of [0, -10, -20, -30, -40, -50]) {
    const y = yFor(tick);
    context.beginPath();
    context.moveTo(plot.x, y);
    context.lineTo(plot.x + plot.width, y);
    context.stroke();
    context.textAlign = "right";
    context.fillText(String(tick), plot.x - 10, y + 4);
  }

  for (const tick of [1, 2, 3, 4, 5]) {
    const x = xFor(tick);
    context.beginPath();
    context.moveTo(x, plot.y);
    context.lineTo(x, plot.y + plot.height);
    context.stroke();
    context.textAlign = "center";
    context.fillText(String(tick), x, plot.y + plot.height + 22);
  }

  context.strokeStyle = "#6f685d";
  context.lineWidth = 1.25;
  context.beginPath();
  context.moveTo(plot.x, plot.y);
  context.lineTo(plot.x, plot.y + plot.height);
  context.lineTo(plot.x + plot.width, plot.y + plot.height);
  context.stroke();

  for (const familyId of ["d1", "d2"]) {
    const series = SERIES[familyId];
    context.strokeStyle = series.colour;
    context.lineWidth = 2.3;
    context.setLineDash(series.dashed ? [8, 6] : []);
    context.beginPath();
    state.evidence.records.forEach((record, index) => {
      const x = xFor(record.voltage_kv);
      const y = yFor(record[familyId].radius_shift_um);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
  }
  context.setLineDash([]);

  const selected = state.evidence.records[state.voltageIndex];
  const selectedX = xFor(selected.voltage_kv);
  context.strokeStyle = "#9c968b";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(selectedX, plot.y);
  context.lineTo(selectedX, plot.y + plot.height);
  context.stroke();

  for (const familyId of ["d1", "d2"]) {
    context.beginPath();
    context.arc(
      selectedX,
      yFor(selected[familyId].radius_shift_um),
      compact ? 4 : 5,
      0,
      Math.PI * 2,
    );
    context.fillStyle = SERIES[familyId].colour;
    context.fill();
    context.strokeStyle = "#ffffff";
    context.lineWidth = 1.5;
    context.stroke();
  }

  context.fillStyle = "#39352f";
  context.textAlign = "center";
  context.font = `${compact ? 11 : 14}px "Times New Roman"`;
  context.fillText(
    "Accelerating voltage / kV",
    plot.x + plot.width / 2,
    height - (compact ? 18 : 24),
  );
  context.save();
  context.translate(compact ? 16 : 22, plot.y + plot.height / 2);
  context.rotate(-Math.PI / 2);
  context.fillText("Relativistic radius shift Δx / µm", 0, 0);
  context.restore();
}

function signed(value, digits, unit) {
  const rendered = `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(digits)}`;
  return `${rendered} ${unit}`;
}

function setVoltage(voltageV) {
  if (!state.evidence) return;
  const bounded = Math.min(5000, Math.max(1000, Number(voltageV)));
  const snapped = Math.round((bounded - 1000) / 10) * 10 + 1000;
  state.voltageIndex = (snapped - 1000) / 10;
  const record = state.evidence.records[state.voltageIndex];
  const correction = record.wavelength_correction_percent;

  outputs.voltage.textContent = `${record.voltage_kv.toFixed(2)} kV comparison`;
  outputs.nonrelWavelength.textContent = `${record.wavelength_nonrel_pm.toFixed(4)} pm`;
  outputs.relWavelength.textContent = `${record.wavelength_rel_pm.toFixed(4)} pm`;
  outputs.correction.textContent = signed(correction, 4, "%");
  outputs.d1Nonrel.textContent = `${record.d1.radius_nonrel_mm.toFixed(4)} mm`;
  outputs.d1Rel.textContent = `${record.d1.radius_rel_mm.toFixed(4)} mm`;
  outputs.d1Shift.textContent = signed(record.d1.radius_shift_um, 2, "µm");
  outputs.d2Nonrel.textContent = `${record.d2.radius_nonrel_mm.toFixed(4)} mm`;
  outputs.d2Rel.textContent = `${record.d2.radius_rel_mm.toFixed(4)} mm`;
  outputs.d2Shift.textContent = signed(record.d2.radius_shift_um, 2, "µm");
  outputs.conclusion.textContent =
    `At ${record.voltage_kv.toFixed(2)} kV, relativity shortens λ by ${Math.abs(correction).toFixed(4)}%. ` +
    `The d₁ first-order ring moves inward by ${Math.abs(record.d1.radius_shift_um).toFixed(2)} µm; ` +
    "the non-relativistic spacing recovery remains the baseline.";

  canvas.setAttribute(
    "aria-label",
    `Relativistic first-order ring-radius shift from one to five kilovolts. At ${record.voltage_kv.toFixed(2)} kilovolts, d1 shifts inward by ${Math.abs(record.d1.radius_shift_um).toFixed(2)} micrometres and d2 shifts inward by ${Math.abs(record.d2.radius_shift_um).toFixed(2)} micrometres.`,
  );
  drawChart();
}

function handleVoltage(event) {
  setVoltage(event.detail?.voltageV ?? voltageControl.value);
}

function showFailure() {
  document.documentElement.dataset.task06Relativity = "error";
  section.classList.remove("is-loading");
  section.classList.add("has-error");
  document.querySelector("[data-extension-loading]").hidden = true;
  document.querySelector("[data-extension-error]").hidden = false;
  outputs.status.textContent = "Extension evidence unavailable";
}

async function initialise() {
  try {
    const response = await fetch(EVIDENCE_URL, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Extension evidence returned ${response.status}`);
    state.evidence = validateEvidence(await response.json());
    section.classList.remove("is-loading");
    document.querySelector("[data-extension-loading]").hidden = true;
    outputs.status.textContent = "10 / 10 checks · baseline preserved";
    setVoltage(voltageControl.value);
    document.documentElement.dataset.task06Relativity = "ready";

    window.addEventListener("task06:voltage", handleVoltage);
    state.resizeObserver = new ResizeObserver(drawChart);
    state.resizeObserver.observe(canvas);
    disclosure?.addEventListener("toggle", () => {
      if (disclosure.open) requestAnimationFrame(drawChart);
    });
    window.addEventListener(
      "pagehide",
      () => {
        window.removeEventListener("task06:voltage", handleVoltage);
        state.resizeObserver?.disconnect();
      },
      { once: true },
    );
  } catch {
    showFailure();
  }
}

initialise();
