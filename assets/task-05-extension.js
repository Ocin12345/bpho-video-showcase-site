const evidenceUrl = new URL(
  "../data/task05/reduced_mass_validation.json",
  import.meta.url,
);

const lab = document.querySelector("[data-mass-lab]");
const selector = document.querySelector("#mass-transition-selector");
const canvas = document.querySelector("#mass-comparison-chart");
const context = canvas.getContext("2d");
const tableBody = document.querySelector("[data-mass-table-body]");
const downloadButton = document.querySelector("[data-download-mass-chart]");

const outputs = {
  status: document.querySelector("[data-mass-status]"),
  idealWavelength: document.querySelector("[data-mass-ideal-wavelength]"),
  correctedWavelength: document.querySelector(
    "[data-mass-corrected-wavelength]",
  ),
  wavelengthShift: document.querySelector("[data-mass-wavelength-shift]"),
  energyShift: document.querySelector("[data-mass-energy-shift]"),
  factor: document.querySelector("[data-mass-factor]"),
  relativeShift: document.querySelector("[data-mass-relative-shift]"),
  error: document.querySelector("[data-mass-error]"),
};

const state = {
  evidence: null,
  selectedIndex: 0,
};

function relativeError(observed, expected) {
  if (expected === 0) return Math.abs(observed);
  return Math.abs(observed - expected) / Math.abs(expected);
}

function finite(value, label) {
  if (!Number.isFinite(value)) throw new Error(`${label} is not finite`);
  return value;
}

function validateEvidence(payload) {
  const ratio = payload?.constants?.electron_proton_mass_ratio;
  const factor = payload?.constants?.reduced_mass_factor;
  const transitions = payload?.transitions;
  const checks = payload?.validation?.checks;
  if (
    payload?.schema_version !== "task05-reduced-mass-v1" ||
    payload?.status !== "accepted_optional_extension" ||
    payload?.baseline_model !== "ideal stationary-nucleus Bohr hydrogen" ||
    payload?.scope?.transition_count !== 45 ||
    payload?.validation?.passed !== true ||
    payload?.validation?.check_count !== 12 ||
    !Array.isArray(checks) ||
    checks.length !== 12 ||
    !checks.every(
      (check) =>
        check.passed === true &&
        Number.isFinite(check.observed) &&
        Number.isFinite(check.expected) &&
        Number.isFinite(check.tolerance),
    ) ||
    !Array.isArray(transitions) ||
    transitions.length !== 45 ||
    relativeError(factor, 1 / (1 + ratio)) > 5e-15
  ) {
    throw new Error("Unsupported or unvalidated reduced-mass evidence");
  }

  const seen = new Set();
  transitions.forEach((transition, index) => {
    const values = [
      transition.ideal_energy_ev,
      transition.corrected_energy_ev,
      transition.ideal_frequency_hz,
      transition.corrected_frequency_hz,
      transition.ideal_wavelength_nm,
      transition.corrected_wavelength_nm,
      transition.wavelength_shift_nm,
      transition.wavelength_shift_pm,
      transition.relative_shift,
    ];
    values.forEach((value) => finite(value, `transition ${index}`));
    const pair = `${transition.initial_n}-${transition.final_n}`;
    if (
      seen.has(pair) ||
      transition.initial_n <= transition.final_n ||
      transition.initial_n > 10 ||
      transition.corrected_wavelength_nm <= transition.ideal_wavelength_nm ||
      transition.corrected_energy_ev >= transition.ideal_energy_ev ||
      relativeError(transition.corrected_energy_ev, transition.ideal_energy_ev * factor) >
        5e-13 ||
      relativeError(
        transition.corrected_wavelength_nm,
        transition.ideal_wavelength_nm / factor,
      ) > 5e-13 ||
      relativeError(transition.relative_shift, ratio) > 5e-13
    ) {
      throw new Error(`Transition ${pair} fails extension validation`);
    }
    seen.add(pair);
  });
  return payload;
}

function formatLineName(value) {
  return value
    .replace("-alpha", "-α")
    .replace("-beta", "-β")
    .replace("-gamma", "-γ")
    .replace("-delta", "-δ");
}

function transitionLabel(transition) {
  const name = transition.line_name
    ? formatLineName(transition.line_name)
    : transition.series_name;
  return `${name} · ${transition.initial_n}→${transition.final_n}`;
}

function fitCanvas() {
  const width = Math.max(canvas.clientWidth, 320);
  const height = Math.max(canvas.clientHeight, 320);
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { width, height };
}

function drawComparison() {
  if (!state.evidence) return;
  const transition = state.evidence.transitions[state.selectedIndex];
  const { width, height } = fitCanvas();
  const left = width < 560 ? 54 : 78;
  const right = width < 560 ? 24 : 42;
  const top = 42;
  const bottom = 70;
  const plotWidth = width - left - right;
  const plotTop = top + 62;
  const plotBottom = height - bottom;
  const shift = transition.wavelength_shift_nm;
  const minimum = transition.ideal_wavelength_nm - shift * 0.8;
  const maximum = transition.corrected_wavelength_nm + shift * 0.8;
  const xFor = (value) => left + ((value - minimum) / (maximum - minimum)) * plotWidth;

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#25231f";
  context.font = '600 18px "Times New Roman", Times, serif';
  context.textAlign = "left";
  context.fillText(transitionLabel(transition), left, 28);
  context.fillStyle = "#6d6961";
  context.font = '13px "Times New Roman", Times, serif';
  context.fillText("Magnified vacuum-wavelength window", left, 50);

  context.strokeStyle = "#dedbd4";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(left, plotBottom);
  context.lineTo(width - right, plotBottom);
  context.stroke();

  for (let index = 0; index <= 4; index += 1) {
    const value = minimum + ((maximum - minimum) * index) / 4;
    const x = xFor(value);
    context.strokeStyle = "#ebe8e2";
    context.beginPath();
    context.moveTo(x, plotTop);
    context.lineTo(x, plotBottom + 6);
    context.stroke();
    context.fillStyle = "#6d6961";
    context.font = '12px "Times New Roman", Times, serif';
    context.textAlign = "center";
    context.fillText(value.toFixed(value < 1000 ? 4 : 2), x, plotBottom + 24);
  }
  context.fillStyle = "#6d6961";
  context.fillText("vacuum wavelength / nm", left + plotWidth / 2, height - 18);

  const markers = [
    {
      value: transition.ideal_wavelength_nm,
      colour: "#34322e",
      label: "Ideal, infinite-mass nucleus",
      valueLabel: `${transition.ideal_wavelength_nm.toFixed(6)} nm`,
    },
    {
      value: transition.corrected_wavelength_nm,
      colour: "#a24f39",
      label: "Proton reduced mass",
      valueLabel: `${transition.corrected_wavelength_nm.toFixed(6)} nm`,
    },
  ];
  markers.forEach((marker, index) => {
    const x = xFor(marker.value);
    const labelY = 78 + index * 25;
    context.strokeStyle = marker.colour;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(x, plotTop);
    context.lineTo(x, plotBottom);
    context.stroke();
    context.fillStyle = marker.colour;
    context.beginPath();
    context.arc(x, plotTop, 5, 0, Math.PI * 2);
    context.fill();
    context.textAlign = index === 0 ? "left" : "right";
    context.font = '600 13px "Times New Roman", Times, serif';
    context.fillText(
      `${marker.label} · ${marker.valueLabel}`,
      index === 0 ? left : width - right,
      labelY,
    );
  });

  canvas.setAttribute(
    "aria-label",
    `${transitionLabel(transition)}. Ideal wavelength ${transition.ideal_wavelength_nm.toFixed(
      6,
    )} nanometres; proton reduced-mass wavelength ${transition.corrected_wavelength_nm.toFixed(
      6,
    )} nanometres; shift ${transition.wavelength_shift_pm.toFixed(3)} picometres.`,
  );
}

function updateSelection(index) {
  if (!state.evidence) return;
  const count = state.evidence.transitions.length;
  state.selectedIndex = Math.max(0, Math.min(Number(index), count - 1));
  const transition = state.evidence.transitions[state.selectedIndex];
  selector.value = String(state.selectedIndex);
  outputs.status.textContent = transitionLabel(transition);
  outputs.idealWavelength.textContent = `${transition.ideal_wavelength_nm.toFixed(6)} nm`;
  outputs.correctedWavelength.textContent = `${transition.corrected_wavelength_nm.toFixed(6)} nm`;
  outputs.wavelengthShift.textContent = `+${transition.wavelength_shift_pm.toFixed(3)} pm`;
  const energyShiftMev =
    (transition.corrected_energy_ev - transition.ideal_energy_ev) * 1e3;
  outputs.energyShift.textContent = `${energyShiftMev.toFixed(6)} meV`;
  drawComparison();
}

function populateSelector() {
  const fragment = document.createDocumentFragment();
  state.evidence.transitions.forEach((transition, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = transitionLabel(transition);
    fragment.append(option);
  });
  selector.replaceChildren(fragment);
}

function populateTable() {
  const rows = state.evidence.featured_transitions.map((transition) => {
    const row = document.createElement("tr");
    const cells = [
      formatLineName(transition.display_label),
      `${transition.initial_n}→${transition.final_n}`,
      transition.ideal_wavelength_nm.toFixed(6),
      transition.corrected_wavelength_nm.toFixed(6),
      transition.wavelength_shift_pm.toFixed(3),
    ];
    cells.forEach((value, index) => {
      const cell = document.createElement(index === 0 ? "th" : "td");
      cell.textContent = value;
      if (index === 0) cell.scope = "row";
      row.append(cell);
    });
    return row;
  });
  tableBody.replaceChildren(...rows);
}

function downloadChart() {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const transition = state.evidence.transitions[state.selectedIndex];
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `task05-reduced-mass-${transition.initial_n}-to-${transition.final_n}.png`;
    link.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

function showFailure(error) {
  lab.classList.remove("is-loading");
  outputs.status.textContent = "Extension data unavailable";
  outputs.error.hidden = false;
  selector.disabled = true;
  downloadButton.disabled = true;
  document.body.dataset.task05ExtensionStatus = "error";
  console.error("Task 5 reduced-mass extension failed", error);
}

async function initialise() {
  try {
    const response = await fetch(evidenceUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Evidence request failed: ${response.status}`);
    state.evidence = validateEvidence(await response.json());
    populateSelector();
    populateTable();
    outputs.factor.textContent = state.evidence.constants.reduced_mass_factor.toFixed(12);
    const ratio = state.evidence.constants.electron_proton_mass_ratio;
    outputs.relativeShift.textContent = `${(ratio * 100).toFixed(6)}% (${(
      ratio * 1e6
    ).toFixed(3)} ppm)`;
    document.body.dataset.task05ExtensionStatus = "ready";
    selector.disabled = false;
    downloadButton.disabled = false;
    lab.classList.remove("is-loading");
    const hAlpha = state.evidence.transitions.findIndex(
      (transition) => transition.initial_n === 3 && transition.final_n === 2,
    );
    updateSelection(hAlpha >= 0 ? hAlpha : 0);

    selector.addEventListener("change", () => updateSelection(selector.value));
    downloadButton.addEventListener("click", downloadChart);
    const resizeObserver = new ResizeObserver(drawComparison);
    resizeObserver.observe(canvas);
    window.addEventListener("pagehide", () => resizeObserver.disconnect(), {
      once: true,
    });
    window.dispatchEvent(new CustomEvent("task05-extension:ready"));
  } catch (error) {
    showFailure(error);
  }
}

initialise();
