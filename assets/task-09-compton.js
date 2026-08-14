import {
  COMPTON_WAVELENGTH_PM,
  comptonState,
  sampleComptonCurve,
} from "./task-09-compton-model.js";

const state = {
  wavelengthPm: 10,
  thetaDegrees: 90,
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const wavelengthControl = $("[data-wavelength-control]");
const angleControl = $("[data-angle-control]");
const wavelengthOutput = $("[data-wavelength-output]");
const angleOutput = $("[data-angle-output]");
const status = $("[data-status]");
const geometry = $("#compton-geometry");
const checkpointTable = $("[data-checkpoint-table]");
const chartSvgs = $$('[data-chart]');

const format = (value, digits = 2) => Number(value).toFixed(digits);

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function setText(selector, value) {
  const element = $(selector);
  if (element) element.textContent = value;
}

function setWidth(selector, value) {
  const element = $(selector);
  if (element) element.style.width = `${clamp(value, 0, 100)}%`;
}

function setPath(selector, path) {
  const element = $(selector);
  if (element) element.setAttribute("d", path);
}

function renderGeometry(model) {
  const centre = { x: 380, y: 212 };
  const photonLength = 230;
  const electronLength = 200;
  const theta = (model.thetaDegrees * Math.PI) / 180;
  const phi = (model.recoilAngleDegrees * Math.PI) / 180;
  const photonEnd = {
    x: centre.x + photonLength * Math.cos(theta),
    y: centre.y - photonLength * Math.sin(theta),
  };
  const electronEnd = {
    x: centre.x + electronLength * Math.cos(phi),
    y: centre.y + electronLength * Math.sin(phi),
  };
  const thetaRadius = 62;
  const phiRadius = 76;
  const thetaArcEnd = {
    x: centre.x + thetaRadius * Math.cos(theta),
    y: centre.y - thetaRadius * Math.sin(theta),
  };
  const phiArcEnd = {
    x: centre.x + phiRadius * Math.cos(phi),
    y: centre.y + phiRadius * Math.sin(phi),
  };
  const thetaLabel = {
    x: centre.x + (thetaRadius + 18) * Math.cos(theta / 2),
    y: centre.y - (thetaRadius + 18) * Math.sin(theta / 2),
  };
  const phiLabel = {
    x: centre.x + (phiRadius + 18) * Math.cos(phi / 2),
    y: centre.y + (phiRadius + 18) * Math.sin(phi / 2) + 5,
  };

  setPath("[data-scattered-photon]", `M ${centre.x} ${centre.y} L ${photonEnd.x.toFixed(2)} ${photonEnd.y.toFixed(2)}`);
  setPath("[data-electron-recoil]", `M ${centre.x} ${centre.y} L ${electronEnd.x.toFixed(2)} ${electronEnd.y.toFixed(2)}`);
  setPath("[data-theta-arc]", `M ${centre.x + thetaRadius} ${centre.y} A ${thetaRadius} ${thetaRadius} 0 ${model.thetaDegrees > 180 ? 1 : 0} 0 ${thetaArcEnd.x.toFixed(2)} ${thetaArcEnd.y.toFixed(2)}`);
  setPath("[data-phi-arc]", `M ${centre.x + phiRadius} ${centre.y} A ${phiRadius} ${phiRadius} 0 0 1 ${phiArcEnd.x.toFixed(2)} ${phiArcEnd.y.toFixed(2)}`);

  const scatteredLabel = $("[data-scattered-label]");
  if (scatteredLabel) {
    scatteredLabel.setAttribute("x", (centre.x + (photonLength + 20) * Math.cos(theta)).toFixed(2));
    scatteredLabel.setAttribute("y", (centre.y - (photonLength + 20) * Math.sin(theta) - 8).toFixed(2));
  }
  const electronLabel = $("[data-electron-label]");
  if (electronLabel) {
    electronLabel.setAttribute("x", (centre.x + (electronLength + 20) * Math.cos(phi)).toFixed(2));
    electronLabel.setAttribute("y", (centre.y + (electronLength + 20) * Math.sin(phi) + 5).toFixed(2));
  }
  const thetaLabelElement = $("[data-theta-label]");
  if (thetaLabelElement) {
    thetaLabelElement.setAttribute("x", thetaLabel.x.toFixed(2));
    thetaLabelElement.setAttribute("y", thetaLabel.y.toFixed(2));
  }
  const phiLabelElement = $("[data-phi-label]");
  if (phiLabelElement) {
    phiLabelElement.setAttribute("x", phiLabel.x.toFixed(2));
    phiLabelElement.setAttribute("y", phiLabel.y.toFixed(2));
  }
  const description = $("#geometry-description");
  if (description) description.textContent = `An incoming photon of wavelength ${format(model.wavelengthPm, 1)} picometres strikes a stationary electron. The scattered photon leaves at ${format(model.thetaDegrees, 1)} degrees and the electron recoils at ${format(model.recoilAngleDegrees, 1)} degrees below the incoming direction.`;
}

function niceMaximum(value) {
  if (value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const scale = 10 ** exponent;
  const normalised = value / scale;
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  return step * scale;
}

function chartMarkup(kind, model) {
  const width = 700;
  const height = 390;
  const margin = { left: 70, right: 22, top: 20, bottom: 58 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const samples = sampleComptonCurve(model.wavelengthPm, 181);
  const xFor = (theta) => margin.left + (theta / 180) * plotWidth;
  const maxValue = kind === "shift"
    ? 2 * COMPTON_WAVELENGTH_PM / model.wavelengthPm
    : kind === "speed" ? samples.at(-1).speedFractionC : 90;
  const yMax = kind === "angle" ? 90 : Math.max(kind === "shift" ? 0.01 : 0.05, niceMaximum(maxValue * 1.12));
  const yFor = (value) => margin.top + plotHeight - (value / yMax) * plotHeight;
  const valueFor = (sample) => kind === "shift" ? sample.fractionalShift : kind === "speed" ? sample.speedFractionC : sample.recoilAngleDegrees;
  const yTicks = kind === "angle" ? [0, 30, 60, 90] : Array.from({ length: 5 }, (_, index) => (yMax * index) / 4);
  const linePath = samples.map((sample, index) => `${index === 0 ? "M" : "L"} ${xFor(sample.thetaDegrees).toFixed(2)} ${yFor(valueFor(sample)).toFixed(2)}`).join(" ");
  const selected = comptonState(model.wavelengthPm, model.thetaDegrees);
  const selectedValue = kind === "shift" ? selected.fractionalShift : kind === "speed" ? selected.speedFractionC : selected.recoilAngleDegrees;
  const selectedX = xFor(model.thetaDegrees);
  const selectedY = yFor(selectedValue);
  const yLabel = kind === "shift" ? "Δλ / λ" : kind === "speed" ? "v / c" : "φ / °";
  const tickLabel = (value) => kind === "shift" ? value.toFixed(value < 0.1 ? 3 : 2) : kind === "speed" ? value.toFixed(2) : value.toFixed(0);

  const grid = yTicks.map((tick) => `<line class="chart-grid-line" x1="${margin.left}" x2="${width - margin.right}" y1="${yFor(tick)}" y2="${yFor(tick)}" /><text class="chart-tick-label" x="${margin.left - 10}" y="${yFor(tick) + 4}" text-anchor="end">${tickLabel(tick)}</text>`).join("");
  const xTicks = [0, 45, 90, 135, 180].map((tick) => `<line class="chart-grid-line" x1="${xFor(tick)}" x2="${xFor(tick)}" y1="${margin.top}" y2="${height - margin.bottom}" /><text class="chart-tick-label" x="${xFor(tick)}" y="${height - margin.bottom + 22}" text-anchor="middle">${tick}°</text>`).join("");
  const annotationX = selectedX > width - 130 ? selectedX - 8 : selectedX + 8;
  const annotationAnchor = selectedX > width - 130 ? "end" : "start";

  return `
    <g aria-hidden="true">
      ${grid}
      ${xTicks}
      <line class="chart-axis-line" x1="${margin.left}" x2="${width - margin.right}" y1="${height - margin.bottom}" y2="${height - margin.bottom}" />
      <line class="chart-axis-line" x1="${margin.left}" x2="${margin.left}" y1="${margin.top}" y2="${height - margin.bottom}" />
      <path class="chart-line" d="${linePath}" />
      <line class="chart-selected-line" x1="${selectedX}" x2="${selectedX}" y1="${margin.top}" y2="${height - margin.bottom}" />
      <circle class="chart-selected-point" cx="${selectedX}" cy="${selectedY}" r="6" />
      <rect class="chart-interaction-layer" x="${margin.left}" y="${margin.top}" width="${plotWidth}" height="${plotHeight}" />
      <text class="chart-selected-label" x="${annotationX}" y="${Math.max(margin.top + 14, selectedY - 13)}" text-anchor="${annotationAnchor}">θ = ${format(model.thetaDegrees, 1)}°</text>
      <text class="chart-axis-label" x="${margin.left + plotWidth / 2}" y="${height - 13}" text-anchor="middle">Photon scattering angle θ / °</text>
      <text class="chart-axis-label" transform="translate(17 ${margin.top + plotHeight / 2}) rotate(-90)" text-anchor="middle">${yLabel}</text>
    </g>`;
}

function renderCharts(model) {
  for (const kind of ["shift", "speed", "angle"]) {
    const svg = $(`[data-chart="${kind}"]`);
    if (!svg) continue;
    const title = svg.querySelector("title")?.outerHTML ?? "";
    const description = svg.querySelector("desc")?.outerHTML ?? "";
    svg.innerHTML = title + description + chartMarkup(kind, model);
  }
  setText("[data-chart-speed-summary]", `v = ${format(model.speedFractionC, 3)} c at ${format(model.thetaDegrees, 1)}°`);
  setText("[data-chart-angle-summary]", `φ = ${format(model.recoilAngleDegrees, 1)}° at θ = ${format(model.thetaDegrees, 1)}°`);
}

function setAngleFromPointer(event, svg) {
  const bounds = svg.getBoundingClientRect();
  if (!bounds.width) return;
  const viewBoxX = ((event.clientX - bounds.left) / bounds.width) * 700;
  const plotLeft = 70;
  const plotRight = 678;
  const fraction = clamp((viewBoxX - plotLeft) / (plotRight - plotLeft), 0, 1);
  state.thetaDegrees = 0.5 + fraction * 179.5;
  state.thetaDegrees = Math.round(state.thetaDegrees * 2) / 2;
  render();
}

for (const svg of chartSvgs) {
  svg.addEventListener("pointerdown", (event) => {
    svg.setPointerCapture?.(event.pointerId);
    setAngleFromPointer(event, svg);
  });
  svg.addEventListener("pointermove", (event) => {
    if (svg.hasPointerCapture?.(event.pointerId)) setAngleFromPointer(event, svg);
  });
  svg.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      state.thetaDegrees = clamp(state.thetaDegrees + (event.key === "ArrowRight" ? 0.5 : -0.5), 0.5, 180);
      render();
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      state.thetaDegrees = event.key === "Home" ? 0.5 : 180;
      render();
    }
  });
}

function renderCheckpoints(model) {
  const angles = [30, 90, 135, 180];
  checkpointTable.innerHTML = angles.map((angle) => {
    const checkpoint = comptonState(model.wavelengthPm, angle);
    const selected = Math.abs(angle - model.thetaDegrees) < 0.25;
    return `<tr class="${selected ? "is-selected" : ""}"><th scope="row">${angle}°${selected ? " · selected" : ""}</th><td>${format(checkpoint.scatteredWavelengthPm, 3)}</td><td>${format(checkpoint.fractionalShift, 4)}</td><td>${format(checkpoint.speedFractionC, 3)}</td><td>${format(checkpoint.recoilAngleDegrees, 1)}°</td></tr>`;
  }).join("");
}

function render() {
  const model = comptonState(state.wavelengthPm, state.thetaDegrees);
  wavelengthControl.value = String(state.wavelengthPm);
  angleControl.value = String(state.thetaDegrees);
  wavelengthOutput.textContent = `${format(model.wavelengthPm, 1)} pm`;
  angleOutput.textContent = `${format(model.thetaDegrees, 1)}°`;
  setText("[data-angle-chip]", `${format(model.thetaDegrees, 1)}°`);
  setText("[data-scattered-wavelength]", `${format(model.scatteredWavelengthPm, 2)} pm`);
  setText("[data-fractional-shift]", format(model.fractionalShift, 4));
  setText("[data-recoil-speed]", `${format(model.speedFractionC, 3)} c`);
  setText("[data-recoil-angle]", `${format(model.recoilAngleDegrees, 1)}°`);
  setText("[data-max-shift]", `${format(2 * COMPTON_WAVELENGTH_PM, 3)} pm`);
  const backscatter = comptonState(state.wavelengthPm, 180);
  setText("[data-backscatter-speed]", `${format(backscatter.speedFractionC, 3)} c`);
  setText("[data-backscatter-energy]", `${format(backscatter.kineticEnergyKeV, 1)} keV to the electron`);
  setText("[data-incoming-energy]", `${format(model.photonEnergyKeV, 1)} keV`);
  setText("[data-scattered-energy]", `${format(model.scatteredPhotonEnergyKeV, 1)} keV`);
  setText("[data-recoil-energy]", `${format(model.kineticEnergyKeV, 1)} keV`);
  setText("[data-incoming-energy-note]", format(model.photonEnergyKeV, 1));
  setText("[data-scattered-energy-note]", format(model.scatteredPhotonEnergyKeV, 1));
  setText("[data-recoil-energy-note]", format(model.kineticEnergyKeV, 1));
  setText("[data-energy-status]", "conserved");
  setWidth("[data-incoming-energy-bar]", 100);
  setWidth("[data-scattered-energy-bar]", (model.scatteredPhotonEnergyKeV / model.photonEnergyKeV) * 100);
  setWidth("[data-recoil-energy-bar]", (model.kineticEnergyKeV / model.photonEnergyKeV) * 100);
  status.textContent = `${format(model.photonEnergyKeV, 1)} keV photon`;
  renderGeometry(model);
  renderCharts(model);
  renderCheckpoints(model);
}

wavelengthControl.addEventListener("input", (event) => {
  state.wavelengthPm = Number(event.currentTarget.value);
  render();
});

angleControl.addEventListener("input", (event) => {
  state.thetaDegrees = Number(event.currentTarget.value);
  render();
});

for (const button of $$('[data-angle-preset]')) {
  button.addEventListener("click", () => {
    state.thetaDegrees = Number(button.dataset.anglePreset);
    render();
  });
}

for (const button of $$('[data-wavelength-preset]')) {
  button.addEventListener("click", () => {
    state.wavelengthPm = Number(button.dataset.wavelengthPreset);
    render();
  });
}

render();
