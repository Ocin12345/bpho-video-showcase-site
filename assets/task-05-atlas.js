import { loadTask05Evidence } from "./task-05-evidence.js";

const SERIES = Object.freeze({
  Lyman: { colour: "#f000d8", marker: "asterisk", symbol: "∗" },
  Balmer: { colour: "#f04444", marker: "asterisk", symbol: "∗" },
  Paschen: { colour: "#4c63f1", marker: "asterisk", symbol: "∗" },
  Brackett: { colour: "#20c95c", marker: "asterisk", symbol: "∗" },
  Pfund: { colour: "#292929", marker: "asterisk", symbol: "∗" },
  "Higher series": { colour: "#607089", marker: "asterisk", symbol: "∗" },
});

const TASK_VIEW = Object.freeze({
  wavelengthMinNm: 0,
  wavelengthMaxNm: 8000,
  energyMinEv: 0,
  energyMaxEv: 13.6,
});

const PRIMARY_SERIES_ORDER = Object.freeze([
  "Lyman",
  "Balmer",
  "Paschen",
  "Brackett",
  "Pfund",
]);

const SERIES_ORDER = Object.freeze([
  ...PRIMARY_SERIES_ORDER,
  "Higher series",
]);

const SERIES_COUNTS = Object.freeze({
  Lyman: 9,
  Balmer: 8,
  Paschen: 7,
  Brackett: 6,
  Pfund: 5,
  "Higher series": 10,
});

const LINE_SUFFIXES = Object.freeze({
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
});

const instrument = document.querySelector("[data-transition-instrument]");
const stageCanvas = document.querySelector("#energy-level-stage");
const stageContext = stageCanvas.getContext("2d");
const atlas = document.querySelector("[data-emission-atlas]");
const chartCanvas = document.querySelector("#emission-energy-chart");
const chartContext = chartCanvas.getContext("2d");
const tooltip = document.querySelector("[data-atlas-tooltip]");
const transitionSelector = document.querySelector("#transition-selector");
const transitionControls = document.querySelector("[data-transition-controls]");
const higherSeriesControl = document.querySelector("[data-higher-series]");
const photonRibbon = document.querySelector("[data-photon-ribbon]");
const transitionCsvDownload = document.querySelector(
  "[data-download-transition-csv]",
);

const outputs = {
  transitionTitle: document.querySelector("[data-transition-title]"),
  regionBadge: document.querySelector("[data-region-badge]"),
  photonWavelength: document.querySelector("[data-photon-wavelength]"),
  photonEnergy: document.querySelector("[data-photon-energy]"),
  photonFrequency: document.querySelector("[data-photon-frequency]"),
  photonWavelengthReadout: document.querySelector(
    "[data-photon-wavelength-readout]",
  ),
  atlasStatus: document.querySelector("[data-atlas-status]"),
  atlasTransition: document.querySelector("[data-atlas-transition]"),
  atlasSeries: document.querySelector("[data-atlas-series]"),
  atlasEnergy: document.querySelector("[data-atlas-energy]"),
  atlasWavelength: document.querySelector("[data-atlas-wavelength]"),
  spectrumSelection: document.querySelector("[data-spectrum-selection]"),
  energyScale: document.querySelector("[data-energy-scale]"),
  rydbergResidual: document.querySelector("[data-rydberg-residual]"),
  validationSummary: document.querySelector("[data-validation-summary]"),
};

const state = {
  evidence: null,
  selectedIndex: 0,
  activeSeries: "All",
  visibleOnly: false,
  includeHigherSeries: false,
  chartPoints: [],
  hoveredIndex: null,
};

function formatLineName(name) {
  if (!name) return "";
  const [series, suffix] = name.split("-");
  const symbol = LINE_SUFFIXES[suffix] || suffix;
  return series === "H" ? `H-${symbol}` : `${series}-${symbol}`;
}

function displaySeries(transition) {
  return transition.finalN <= 5 ? transition.seriesName : "Higher series";
}

function transitionLabel(transition) {
  const named = formatLineName(transition.lineName);
  return named
    ? `${named} · ${transition.initialN}→${transition.finalN}`
    : `${transition.initialN}→${transition.finalN}`;
}

function transitionOptionLabel(transition) {
  const named = formatLineName(transition.lineName);
  return `${transition.initialN}→${transition.finalN} · ${
    named || displaySeries(transition)
  } · ${formatWavelength(transition.wavelengthNm)}`;
}

function formatEnergy(value) {
  return `${value.toFixed(value >= 10 ? 4 : 6)} eV`;
}

function formatWavelength(value) {
  if (value >= 10000) return `${(value / 1000).toFixed(3)} µm`;
  if (value >= 1000) return `${value.toFixed(2)} nm`;
  return `${value.toFixed(3)} nm`;
}

function formatFrequency(value) {
  if (value >= 1e15) return `${(value / 1e15).toFixed(4)} PHz`;
  if (value >= 1e12) return `${(value / 1e12).toFixed(3)} THz`;
  return `${value.toExponential(4)} Hz`;
}

function formatRegion(region) {
  if (region === "ultraviolet") return "UV";
  if (region === "infrared") return "IR";
  return "Visible";
}

function wavelengthColour(wavelengthNm) {
  if (wavelengthNm < 380) return "#64748b";
  if (wavelengthNm > 750) return "#8a8178";

  const stops = [
    [380, [120, 0, 168]],
    [430, [55, 28, 255]],
    [480, [0, 178, 255]],
    [510, [0, 222, 168]],
    [550, [75, 230, 68]],
    [590, [252, 232, 42]],
    [620, [255, 133, 34]],
    [680, [237, 42, 42]],
    [750, [150, 24, 37]],
  ];

  for (let index = 1; index < stops.length; index += 1) {
    if (wavelengthNm <= stops[index][0]) {
      const [x0, c0] = stops[index - 1];
      const [x1, c1] = stops[index];
      const t = (wavelengthNm - x0) / (x1 - x0);
      const colour = c0.map((channel, channelIndex) =>
        Math.round(channel + (c1[channelIndex] - channel) * t),
      );
      return `rgb(${colour.join(",")})`;
    }
  }
  return "#961825";
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
  return { width, height, density };
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function drawEnergyStage() {
  if (!state.evidence) return;
  const { width, height } = canvasSize(stageCanvas, stageContext);
  const transition = state.evidence.transitions[state.selectedIndex];
  const compact = width < 520;
  const left = compact ? 48 : 76;
  const right = compact ? 72 : 126;
  const top = compact ? 70 : 52;
  const bottom = compact ? 44 : 48;
  const plotHeight = height - top - bottom;
  const levelX0 = left;
  const levelX1 = width - right;
  const yForLevel = (n) => top + ((10 - n) / 9) * plotHeight;

  stageContext.clearRect(0, 0, width, height);
  stageContext.save();
  stageContext.lineCap = "round";
  stageContext.lineJoin = "round";

  stageContext.fillStyle = "#6d6961";
  stageContext.font = `${compact ? 9 : 11}px "Times New Roman"`;
  stageContext.textAlign = "left";
  if (compact) {
    stageContext.fillText("LEVEL SCHEMATIC · NOT TO SCALE", left, 21);
    stageContext.fillText("ENERGIES LABELLED IN eV", left, 35);
  } else {
    stageContext.fillText(
      "LEVEL-ORDERED SCHEMATIC · ENERGIES LABELLED · NOT TO SCALE",
      left,
      25,
    );
  }

  const ionizationY = compact ? 51 : Math.max(35, top - 18);
  stageContext.setLineDash([5, 5]);
  stageContext.strokeStyle = "rgba(37,35,31,0.28)";
  stageContext.lineWidth = 1;
  stageContext.beginPath();
  stageContext.moveTo(levelX0, ionizationY);
  stageContext.lineTo(levelX1, ionizationY);
  stageContext.stroke();
  stageContext.setLineDash([]);
  stageContext.fillStyle = "#6d6961";
  stageContext.textAlign = "right";
  stageContext.fillText("ionization · 0 eV", width - 14, ionizationY + 4);

  for (const level of state.evidence.levels) {
    const y = yForLevel(level.n);
    const isInitial = level.n === transition.initialN;
    const isFinal = level.n === transition.finalN;

    stageContext.strokeStyle = isInitial
      ? "#a24f39"
      : isFinal
        ? "#25231f"
        : "rgba(37,35,31,0.20)";
    stageContext.lineWidth = isInitial || isFinal ? 3 : 1.15;
    stageContext.beginPath();
    stageContext.moveTo(levelX0, y);
    stageContext.lineTo(levelX1, y);
    stageContext.stroke();

    stageContext.fillStyle = isInitial
      ? "#a24f39"
      : isFinal
        ? "#25231f"
        : "#6d6961";
    stageContext.font = `${isInitial || isFinal ? "bold " : ""}${
      compact ? 12 : 14
    }px "Times New Roman"`;
    stageContext.textAlign = "right";
    stageContext.fillText(`n=${level.n}`, levelX0 - 10, y + 4);
    stageContext.textAlign = "left";
    stageContext.fillText(
      `${level.energyEv.toFixed(level.n <= 3 ? 3 : 4)} eV`,
      levelX1 + 10,
      y + 4,
    );
  }

  const arrowX = levelX0 + (levelX1 - levelX0) * (compact ? 0.72 : 0.76);
  const startY = yForLevel(transition.initialN) + 7;
  const endY = yForLevel(transition.finalN) - 8;
  stageContext.strokeStyle = wavelengthColour(transition.wavelengthNm);
  stageContext.fillStyle = wavelengthColour(transition.wavelengthNm);
  stageContext.shadowColor = wavelengthColour(transition.wavelengthNm);
  stageContext.shadowBlur = 12;
  stageContext.lineWidth = 3;
  stageContext.beginPath();
  stageContext.moveTo(arrowX, startY);
  stageContext.lineTo(arrowX, endY);
  stageContext.stroke();
  stageContext.beginPath();
  stageContext.moveTo(arrowX - 7, endY - 10);
  stageContext.lineTo(arrowX, endY);
  stageContext.lineTo(arrowX + 7, endY - 10);
  stageContext.stroke();
  stageContext.shadowBlur = 0;

  const label = `${transition.initialN} → ${transition.finalN}`;
  stageContext.font = `bold ${compact ? 13 : 15}px "Times New Roman"`;
  const labelWidth = stageContext.measureText(label).width + 20;
  const labelX = Math.max(levelX0, arrowX - labelWidth / 2);
  const labelY = (startY + endY) / 2 - 14;
  roundedRect(stageContext, labelX, labelY, labelWidth, 28, 2);
  stageContext.fillStyle = "rgba(22,17,29,0.94)";
  stageContext.fill();
  stageContext.strokeStyle = wavelengthColour(transition.wavelengthNm);
  stageContext.lineWidth = 1;
  stageContext.stroke();
  stageContext.fillStyle = "#f8f0f5";
  stageContext.textAlign = "center";
  stageContext.fillText(label, labelX + labelWidth / 2, labelY + 19);

  stageContext.restore();
}

function filteredTransitions() {
  if (!state.evidence) return [];
  return state.evidence.transitions.filter((transition) => {
    const inPrimarySeries = transition.finalN <= 5;
    if (!state.includeHigherSeries && !inPrimarySeries) return false;
    const seriesMatches =
      state.activeSeries === "All" ||
      displaySeries(transition) === state.activeSeries;
    const regionMatches =
      !state.visibleOnly || transition.spectralRegion === "visible";
    return seriesMatches && regionMatches;
  });
}

function atlasStatusText(candidates = filteredTransitions()) {
  if (state.visibleOnly) {
    return `${candidates.length} ${
      candidates.length === 1 ? "emission" : "emissions"
    } shown · visible window`;
  }
  const plotted = candidates.filter(
    (transition) => transition.wavelengthNm <= TASK_VIEW.wavelengthMaxNm,
  ).length;
  const omitted = candidates.length - plotted;
  if (!state.includeHigherSeries) {
    return `${plotted} emissions · Lyman–Pfund · reference view`;
  }
  return `${plotted} plotted · extended catalogue${
    omitted ? ` · ${omitted} beyond 8000 nm` : ""
  }`;
}

function drawMarker(context, marker, x, y, size, colour, selected = false) {
  context.save();
  context.translate(x, y);
  context.strokeStyle = selected ? "#211b27" : colour;
  context.fillStyle = colour;
  context.lineWidth = selected ? 2.4 : 1.6;
  context.beginPath();

  if (marker === "asterisk") {
    context.lineCap = "round";
    context.strokeStyle = colour;
    context.lineWidth = selected ? 2.4 : 1.5;
    for (let arm = 0; arm < 3; arm += 1) {
      const angle = (Math.PI / 3) * arm;
      const dx = Math.cos(angle) * size;
      const dy = Math.sin(angle) * size;
      context.moveTo(-dx, -dy);
      context.lineTo(dx, dy);
    }
    context.stroke();
  } else if (marker === "circle") {
    context.arc(0, 0, size, 0, Math.PI * 2);
    context.fill();
  } else if (marker === "square") {
    context.rect(-size, -size, size * 2, size * 2);
    context.fill();
  } else if (marker === "triangle") {
    context.moveTo(0, -size * 1.18);
    context.lineTo(size * 1.08, size * 0.85);
    context.lineTo(-size * 1.08, size * 0.85);
    context.closePath();
    context.fill();
  } else if (marker === "diamond") {
    context.moveTo(0, -size * 1.2);
    context.lineTo(size * 1.1, 0);
    context.lineTo(0, size * 1.2);
    context.lineTo(-size * 1.1, 0);
    context.closePath();
    context.fill();
  } else if (marker === "plus") {
    context.moveTo(-size, 0);
    context.lineTo(size, 0);
    context.moveTo(0, -size);
    context.lineTo(0, size);
    context.strokeStyle = colour;
    context.lineWidth = selected ? 4 : 3;
    context.stroke();
  } else {
    context.moveTo(-size * 0.8, -size * 0.8);
    context.lineTo(size * 0.8, size * 0.8);
    context.moveTo(size * 0.8, -size * 0.8);
    context.lineTo(-size * 0.8, size * 0.8);
    context.strokeStyle = colour;
    context.lineWidth = selected ? 3.4 : 2.5;
    context.stroke();
  }

  if (selected) {
    context.beginPath();
    context.arc(0, 0, size + 5, 0, Math.PI * 2);
    context.strokeStyle = "#211b27";
    context.lineWidth = 1.4;
    context.stroke();
  }
  context.restore();
}

function drawSeriesLegend(context, plot, compact) {
  const names = state.includeHigherSeries ? SERIES_ORDER : PRIMARY_SERIES_ORDER;
  const entries = names.map((name) => [name, SERIES[name].symbol]);
  const columns = compact ? 2 : 1;
  const rows = Math.ceil(entries.length / columns);
  const cellWidth = compact ? Math.min(132, (plot.width - 20) / columns) : 148;
  const legendWidth = cellWidth * columns + 16;
  const legendHeight = rows * 21 + 14;
  const startX = plot.x + plot.width - legendWidth + 10;
  const startY = plot.y + 16;
  context.save();
  context.fillStyle = "rgba(255, 255, 255, 0.96)";
  context.strokeStyle = "#c9c9c2";
  context.lineWidth = 1;
  context.fillRect(
    plot.x + plot.width - legendWidth,
    plot.y + 8,
    legendWidth,
    legendHeight,
  );
  context.strokeRect(
    plot.x + plot.width - legendWidth,
    plot.y + 8,
    legendWidth,
    legendHeight,
  );
  context.font = `${compact ? 10 : 12}px "Times New Roman"`;
  context.textAlign = "left";
  context.textBaseline = "middle";
  entries.forEach(([name, symbol], index) => {
    const column = Math.floor(index / rows);
    const row = index % rows;
    const x = startX + column * cellWidth;
    const y = startY + row * 21;
    context.fillStyle = SERIES[name].colour;
    context.font = `bold ${compact ? 13 : 16}px "Times New Roman"`;
    context.fillText(symbol, x, y + 1);
    context.fillStyle = "#20201d";
    context.font = `${compact ? 10 : 12}px "Times New Roman"`;
    context.fillText(name === "Higher series" ? "Higher (nf ≥ 6)" : name, x + 20, y + 1);
  });
  context.restore();
}

function drawAtlasChart() {
  if (!state.evidence) return;
  const { width, height } = canvasSize(chartCanvas, chartContext);
  const compact = width < 620;
  const margins = {
    left: compact ? 64 : 92,
    right: compact ? 20 : 42,
    top: compact ? 62 : 72,
    bottom: compact ? 70 : 82,
  };
  const plot = {
    x: margins.left,
    y: margins.top,
    width: width - margins.left - margins.right,
    height: height - margins.top - margins.bottom,
  };
  const xMin = state.visibleOnly ? 380 : TASK_VIEW.wavelengthMinNm;
  const xMax = state.visibleOnly ? 750 : TASK_VIEW.wavelengthMaxNm;
  const yMin = state.visibleOnly ? 1.65 : TASK_VIEW.energyMinEv;
  const yMax = state.visibleOnly ? 3.35 : TASK_VIEW.energyMaxEv;
  const xFor = (value) =>
    plot.x +
    ((value - xMin) / (xMax - xMin)) * plot.width;
  const yFor = (value) =>
    plot.y + plot.height - ((value - yMin) / (yMax - yMin)) * plot.height;

  chartContext.clearRect(0, 0, width, height);
  chartContext.save();
  chartContext.fillStyle = "#fbfaf7";
  chartContext.fillRect(0, 0, width, height);

  const xTicks = state.visibleOnly
    ? [380, 450, 500, 550, 600, 650, 700, 750]
    : [0, 2000, 4000, 6000, 8000];
  const yTicks = state.visibleOnly
    ? [1.8, 2.0, 2.2, 2.4, 2.6, 2.8, 3.0, 3.2]
    : [0, 2, 4, 6, 8, 10, 12];

  chartContext.font = `${compact ? 11 : 14}px "Times New Roman"`;
  chartContext.fillStyle = "#696964";
  chartContext.strokeStyle = "#deded8";
  chartContext.lineWidth = 1;

  for (const tick of yTicks) {
    const y = yFor(tick);
    chartContext.beginPath();
    chartContext.moveTo(plot.x, y);
    chartContext.lineTo(plot.x + plot.width, y);
    chartContext.stroke();
    chartContext.textAlign = "right";
    chartContext.fillText(
      Number.isInteger(tick) ? String(tick) : tick.toFixed(1),
      plot.x - 12,
      y + 4,
    );
  }

  for (const tick of xTicks) {
    if (tick < xMin || tick > xMax) continue;
    const x = xFor(tick);
    chartContext.beginPath();
    chartContext.moveTo(x, plot.y);
    chartContext.lineTo(x, plot.y + plot.height);
    chartContext.stroke();
    chartContext.textAlign = "center";
    const label = `${tick}`;
    chartContext.fillText(label, x, plot.y + plot.height + 23);
  }

  chartContext.strokeStyle = "#20201d";
  chartContext.lineWidth = 1.4;
  chartContext.beginPath();
  chartContext.moveTo(plot.x, plot.y);
  chartContext.lineTo(plot.x, plot.y + plot.height);
  chartContext.lineTo(plot.x + plot.width, plot.y + plot.height);
  chartContext.stroke();

  chartContext.fillStyle = "#20201d";
  chartContext.font = `${compact ? 13 : 17}px "Times New Roman"`;
  chartContext.textAlign = "center";
  chartContext.fillText(
    state.visibleOnly ? "Vacuum wavelength, λ / nm" : "λ / nm",
    plot.x + plot.width / 2,
    height - (compact ? 18 : 23),
  );
  chartContext.save();
  chartContext.translate(compact ? 19 : 29, plot.y + plot.height / 2);
  chartContext.rotate(-Math.PI / 2);
  chartContext.fillText(
    state.visibleOnly ? "Emitted-photon energy, Eγ / eV" : "Photon energy / eV",
    0,
    0,
  );
  chartContext.restore();

  if (!state.visibleOnly) {
    chartContext.fillStyle = "#20201d";
    chartContext.font = `bold ${compact ? 14 : 19}px "Times New Roman"`;
    chartContext.textAlign = "center";
    chartContext.fillText(
      "Bohr model of Hydrogenic atom",
      plot.x + plot.width / 2,
      compact ? 18 : 21,
    );
    chartContext.font = `${compact ? 13 : 16}px "Times New Roman"`;
    chartContext.fillText(
      "photon emissions: Z = 1",
      plot.x + plot.width / 2,
      compact ? 36 : 43,
    );
  }

  chartContext.save();
  chartContext.beginPath();
  chartContext.rect(plot.x, plot.y, plot.width, plot.height);
  chartContext.clip();

  const points = [];
  const outOfTaskView = [];
  for (const transition of state.evidence.transitions) {
    if (!state.includeHigherSeries && transition.finalN > 5) continue;
    const visible =
      (!state.visibleOnly || transition.spectralRegion === "visible") &&
      (state.activeSeries === "All" ||
        displaySeries(transition) === state.activeSeries);
    if (!visible) continue;
    if (
      !state.visibleOnly &&
      transition.wavelengthNm > TASK_VIEW.wavelengthMaxNm
    ) {
      outOfTaskView.push(transition);
      continue;
    }
    const x = xFor(transition.wavelengthNm);
    const y = yFor(transition.photonEnergyEv);
    if (
      x < plot.x ||
      x > plot.x + plot.width ||
      y < plot.y ||
      y > plot.y + plot.height
    ) {
      continue;
    }
    const seriesName = displaySeries(transition);
    const series = SERIES[seriesName];
    const presentationView =
      document.documentElement.classList.contains("task05-presentation-requested") ||
      document.body.classList.contains("is-task05-presentation");
    const selected =
      !presentationView && transition.index === state.selectedIndex;
    if (!state.visibleOnly) {
      chartContext.save();
      chartContext.strokeStyle = series.colour;
      chartContext.globalAlpha = selected ? 0.94 : 0.72;
      chartContext.setLineDash([4, 3]);
      chartContext.lineWidth = selected ? 2.2 : 1.35;
      chartContext.beginPath();
      chartContext.moveTo(x, plot.y);
      chartContext.lineTo(x, y);
      chartContext.stroke();
      chartContext.restore();
    }
    drawMarker(
      chartContext,
      series.marker,
      x,
      y,
      selected ? 7.2 : compact ? 4.2 : 5.1,
      series.colour,
      selected,
    );
    points.push({ x, y, transition });
  }
  state.chartPoints = points;
  chartCanvas.dataset.taskWavelengthMin = String(xMin);
  chartCanvas.dataset.taskWavelengthMax = String(xMax);
  chartCanvas.dataset.taskEnergyMin = String(yMin);
  chartCanvas.dataset.taskEnergyMax = String(yMax);
  chartCanvas.dataset.plottedPoints = String(points.length);
  chartCanvas.dataset.outOfTaskView = String(outOfTaskView.length);
  chartCanvas.dataset.includedSeries = String(
    state.includeHigherSeries ? SERIES_ORDER.length : PRIMARY_SERIES_ORDER.length,
  );
  chartContext.restore();

  drawSeriesLegend(chartContext, plot, compact);

  if (points.length === 0) {
    chartContext.fillStyle = "#6b5e69";
    chartContext.font = `${compact ? 15 : 18}px "Times New Roman"`;
    chartContext.textAlign = "center";
    chartContext.fillText(
      "No transitions match this series and wavelength window.",
      plot.x + plot.width / 2,
      plot.y + plot.height / 2,
    );
  }

  chartContext.restore();
}

function updateSelection(index, { syncFilter = false, announce = true } = {}) {
  if (!state.evidence) return;
  const count = state.evidence.transitions.length;
  state.selectedIndex = ((index % count) + count) % count;
  const transition = state.evidence.transitions[state.selectedIndex];
  const seriesName = displaySeries(transition);
  const named = formatLineName(transition.lineName);
  const colour = wavelengthColour(transition.wavelengthNm);

  if (syncFilter && state.activeSeries !== "All") {
    state.activeSeries = seriesName;
    syncSeriesControls();
  }

  transitionSelector.value = String(state.selectedIndex);
  outputs.transitionTitle.textContent = named
    ? `${named} · ${transition.initialN} → ${transition.finalN}`
    : `${seriesName} · ${transition.initialN} → ${transition.finalN}`;
  outputs.regionBadge.textContent = formatRegion(transition.spectralRegion);
  outputs.regionBadge.dataset.region = transition.spectralRegion;
  outputs.photonWavelength.textContent = formatWavelength(
    transition.wavelengthNm,
  );
  outputs.photonEnergy.textContent = formatEnergy(transition.photonEnergyEv);
  outputs.photonFrequency.textContent = formatFrequency(transition.frequencyHz);
  outputs.photonWavelengthReadout.textContent = formatWavelength(
    transition.wavelengthNm,
  );
  outputs.atlasTransition.textContent = `${transition.initialN}→${transition.finalN}`;
  outputs.atlasSeries.textContent = seriesName;
  outputs.atlasEnergy.textContent = formatEnergy(transition.photonEnergyEv);
  outputs.atlasWavelength.textContent = formatWavelength(
    transition.wavelengthNm,
  );

  photonRibbon.style.setProperty("--photon-colour", colour);
  photonRibbon.dataset.region = transition.spectralRegion;
  photonRibbon.classList.remove("is-pulsing");
  requestAnimationFrame(() => photonRibbon.classList.add("is-pulsing"));

  stageCanvas.setAttribute(
    "aria-label",
    `${transitionLabel(transition)} hydrogen emission. Initial level ${
      transition.initialN
    } at ${transition.initialEnergyEv.toFixed(4)} electronvolts descends to level ${
      transition.finalN
    } at ${transition.finalEnergyEv.toFixed(4)} electronvolts, emitting ${formatEnergy(
      transition.photonEnergyEv,
    )} at ${formatWavelength(transition.wavelengthNm)}.`,
  );

  drawEnergyStage();
  drawAtlasChart();
  updateBalmerSelection(transition);

  if (announce) {
    outputs.atlasStatus.textContent = `${transitionLabel(
      transition,
    )} · ${formatWavelength(transition.wavelengthNm)}`;
  }
}

function syncSeriesControls() {
  document.querySelectorAll("[data-series]").forEach((button) => {
    const active = button.dataset.series === state.activeSeries;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.querySelectorAll(".series-row").forEach((button) => {
    const active = button.dataset.ledgerSeries === state.activeSeries;
    button.classList.toggle("is-active", active);
  });
}

function chooseSeries(seriesName) {
  state.activeSeries = seriesName;
  syncSeriesControls();
  const candidates = filteredTransitions();
  if (
    candidates.length &&
    !candidates.some((transition) => transition.index === state.selectedIndex)
  ) {
    updateSelection(candidates[0].index, { announce: false });
  } else {
    drawAtlasChart();
  }
  outputs.atlasStatus.textContent = atlasStatusText(candidates);
}

function populateTransitionSelector() {
  const fragment = document.createDocumentFragment();
  for (const transition of state.evidence.transitions) {
    const option = document.createElement("option");
    option.value = String(transition.index);
    option.textContent = transitionOptionLabel(transition);
    fragment.append(option);
  }
  transitionSelector.replaceChildren(fragment);
}

function populateSeriesLedger() {
  const ledger = document.querySelector("[data-series-ledger]");
  const fragment = document.createDocumentFragment();

  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = "series-row is-active";
  allButton.dataset.ledgerSeries = "All";
  allButton.style.setProperty("--series-colour", "#e85d9f");
  allButton.innerHTML = `
    <i class="series-marker" aria-hidden="true">∑</i>
    <div><span>Reference view</span><small>Lyman through Pfund</small></div>
    <em data-primary-series-total>35 lines</em>
  `;
  fragment.append(allButton);

  for (const seriesName of PRIMARY_SERIES_ORDER) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "series-row";
    button.dataset.ledgerSeries = seriesName;
    button.style.setProperty("--series-colour", SERIES[seriesName].colour);
    const finalLabel =
      seriesName === "Higher series" ? "n_f = 6–9" : `n_f = ${SERIES_ORDER.indexOf(seriesName) + 1}`;
    button.innerHTML = `
      <i class="series-marker" aria-hidden="true">${SERIES[seriesName].symbol}</i>
      <div><span>${seriesName}</span><small>${finalLabel}</small></div>
      <em>${SERIES_COUNTS[seriesName]} lines</em>
    `;
    fragment.append(button);
  }
  ledger.replaceChildren(fragment);
}

function syncSeriesLedgerMode() {
  const total = document.querySelector("[data-primary-series-total]");
  if (!total) return;
  total.textContent = state.includeHigherSeries ? "45 lines" : "35 lines";
  const label = total.previousElementSibling;
  if (label) {
    label.innerHTML = state.includeHigherSeries
      ? "<span>Extended catalogue</span><small>All declared pairs</small>"
      : "<span>Reference view</span><small>Lyman through Pfund</small>";
  }
}

function populateLimitLedger() {
  const ledger = document.querySelector("[data-limit-ledger]");
  const fragment = document.createDocumentFragment();
  for (const limit of state.evidence.limits) {
    const row = document.createElement("div");
    row.className = "limit-row";
    row.style.setProperty("--series-colour", SERIES[limit.seriesName].colour);
    row.innerHTML = `
      <div>
        <span>n<sub>f</sub> = ${limit.finalN}</span>
        <strong>${limit.seriesName}</strong>
        <em>${limit.wavelengthNm.toFixed(3)} nm</em>
        <small>E<sub>∞</sub> = ${limit.energyEv.toFixed(6)} eV</small>
      </div>
    `;
    fragment.append(row);
  }
  ledger.replaceChildren(fragment);
}

function populateBalmerInstrument() {
  const visible = state.evidence.transitions
    .filter((transition) => transition.spectralRegion === "visible")
    .sort((a, b) => a.wavelengthNm - b.wavelengthNm);
  const lines = document.querySelector("[data-balmer-lines]");
  const list = document.querySelector("[data-visible-lines-list]");
  const lineFragment = document.createDocumentFragment();
  const cardFragment = document.createDocumentFragment();

  for (const transition of visible) {
    const line = document.createElement("i");
    const position = ((transition.wavelengthNm - 380) / (750 - 380)) * 100;
    line.className = "balmer-line";
    line.setAttribute("data-transition-index", String(transition.index));
    line.dataset.label =
      formatLineName(transition.lineName) ||
      `${transition.initialN}→${transition.finalN}`;
    line.style.setProperty("--x", `${position}%`);
    line.style.setProperty("--height", "238px");
    line.style.setProperty(
      "--line-colour",
      wavelengthColour(transition.wavelengthNm),
    );
    lineFragment.append(line);

    const card = document.createElement("div");
    card.className = "balmer-line-card";
    card.setAttribute("data-transition-index", String(transition.index));
    card.innerHTML = `
      <span>${formatLineName(transition.lineName) || "Balmer line"}</span>
      <strong>${transition.wavelengthNm.toFixed(3)} nm</strong>
      <small>${transition.initialN}→${transition.finalN} · ${transition.photonEnergyEv.toFixed(4)} eV</small>
    `;
    cardFragment.append(card);
  }
  lines.replaceChildren(lineFragment);
  list.replaceChildren(cardFragment);
}

function updateBalmerSelection(transition) {
  const selected = transition.spectralRegion === "visible";
  document
    .querySelectorAll("[data-transition-index]")
    .forEach((element) => {
      element.classList.toggle(
        "is-selected",
        selected && Number(element.dataset.transitionIndex) === transition.index,
      );
    });

  const label = transitionLabel(transition);
  if (selected) {
    outputs.spectrumSelection.textContent = `${label} highlighted at ${formatWavelength(
      transition.wavelengthNm,
    )}.`;
  } else {
    outputs.spectrumSelection.textContent = `${label} is ${formatWavelength(
      transition.wavelengthNm,
    )}, outside 380–750 nm; no visible line is highlighted.`;
  }

  document.querySelector("[data-balmer-scale]").setAttribute(
    "aria-label",
    selected
      ? `Wavelength-accurate positions of seven visible Balmer transitions. ${label} is selected at ${transition.wavelengthNm.toFixed(3)} nanometres.`
      : `Wavelength-accurate positions of seven visible Balmer transitions. The selected ${label} transition lies outside the plotted visible convention.`,
  );
}

function formatScientific(value, digits = 2) {
  if (value === 0) return "0";
  const exponent = Math.floor(Math.log10(Math.abs(value)));
  const coefficient = value / 10 ** exponent;
  const superscript = String(exponent)
    .replace("-", "−")
    .replace(/0/g, "⁰")
    .replace(/1/g, "¹")
    .replace(/2/g, "²")
    .replace(/3/g, "³")
    .replace(/4/g, "⁴")
    .replace(/5/g, "⁵")
    .replace(/6/g, "⁶")
    .replace(/7/g, "⁷")
    .replace(/8/g, "⁸")
    .replace(/9/g, "⁹");
  return `${coefficient.toFixed(digits)} × 10${superscript}`;
}

function populateValidationEvidence() {
  const constants = state.evidence.manifest.constants;
  const invariantValues = state.evidence.levels.map(
    (level) => Math.abs(level.energyEv) * level.n ** 2,
  );
  const invariant =
    invariantValues.reduce((total, value) => total + value, 0) /
    invariantValues.length;
  const rydbergCheck = state.evidence.validation.checks.find(
    (check) => check.name === "rydberg_wavelength_reference",
  );
  const representativePairs = new Set([
    "2-1",
    "3-1",
    "3-2",
    "4-2",
    "5-2",
    "4-3",
  ]);
  const rows = state.evidence.transitions
    .filter((transition) =>
      representativePairs.has(`${transition.initialN}-${transition.finalN}`),
    )
    .map((transition) => {
      const rydbergWavelengthNm =
        1e9 /
        (constants.rydberg_constant_per_m *
          (1 / transition.finalN ** 2 - 1 / transition.initialN ** 2));
      const residual =
        Math.abs(transition.wavelengthNm - rydbergWavelengthNm) /
        rydbergWavelengthNm;
      const row = document.createElement("tr");
      row.innerHTML = `
        <th scope="row">${transition.initialN}→${transition.finalN}</th>
        <td>${transition.seriesName}</td>
        <td>${transition.photonEnergyEv.toFixed(6)}</td>
        <td>${transition.wavelengthNm.toFixed(6)}</td>
        <td>${formatScientific(residual)}</td>
      `;
      return row;
    });

  outputs.energyScale.textContent = `≈ ${constants.rydberg_energy_ev.toPrecision(
    17,
  )} eV`;
  outputs.rydbergResidual.textContent = formatScientific(
    rydbergCheck?.observed ?? 0,
  );
  outputs.validationSummary.textContent = `${
    state.evidence.validation.checks.filter((check) => check.passed).length
  }/${state.evidence.validation.checks.length}`;
  document
    .querySelector("[data-validation-transitions]")
    .replaceChildren(...rows);
}

function downloadTransitionCsv() {
  transitionCsvDownload.dataset.catalogueState = state.evidence
    ? "validated"
    : "unverified";
}

function showTooltip(point, clientX, clientY) {
  const transition = point.transition;
  tooltip.innerHTML = `
    <strong>${transitionLabel(transition)}</strong><br>
    ${formatEnergy(transition.photonEnergyEv)}<br>
    ${formatWavelength(transition.wavelengthNm)}<br>
    ${transition.spectralRegion}
  `;
  tooltip.hidden = false;
  const bounds = atlas.querySelector(".atlas-chart-wrap").getBoundingClientRect();
  const tooltipWidth = 205;
  const left = Math.min(
    bounds.width - tooltipWidth - 12,
    Math.max(12, clientX - bounds.left + 16),
  );
  const top = Math.min(
    bounds.height - 116,
    Math.max(12, clientY - bounds.top + 16),
  );
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
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

function handleChartPointerMove(event) {
  const nearest = nearestChartPoint(event);
  if (!nearest) {
    state.hoveredIndex = null;
    tooltip.hidden = true;
    chartCanvas.style.cursor = "crosshair";
    return;
  }
  state.hoveredIndex = nearest.transition.index;
  chartCanvas.style.cursor = "pointer";
  showTooltip(nearest, event.clientX, event.clientY);
}

function handleChartClick(event) {
  const nearest = nearestChartPoint(event);
  if (!nearest) return;
  updateSelection(nearest.transition.index);
}

function stepWithinCurrentView(direction) {
  const candidates = filteredTransitions()
    .slice()
    .sort((a, b) => a.wavelengthNm - b.wavelengthNm);
  if (!candidates.length) return;
  const current = candidates.findIndex(
    (transition) => transition.index === state.selectedIndex,
  );
  const next =
    current < 0
      ? direction > 0
        ? 0
        : candidates.length - 1
      : (current + direction + candidates.length) % candidates.length;
  updateSelection(candidates[next].index);
}

function handleChartKeydown(event) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const candidates = filteredTransitions()
    .slice()
    .sort((a, b) => a.wavelengthNm - b.wavelengthNm);
  if (!candidates.length) return;
  if (event.key === "Home") updateSelection(candidates[0].index);
  else if (event.key === "End") {
    updateSelection(candidates[candidates.length - 1].index);
  } else {
    stepWithinCurrentView(event.key === "ArrowRight" ? 1 : -1);
  }
}

function enableControls() {
  transitionControls
    .querySelectorAll("button, select")
    .forEach((control) => (control.disabled = false));
  atlas
    .querySelectorAll("button, input")
    .forEach((control) => (control.disabled = false));
}

function disableControls() {
  transitionControls
    .querySelectorAll("button, select")
    .forEach((control) => (control.disabled = true));
  atlas
    .querySelectorAll("button, input")
    .forEach((control) => (control.disabled = true));
}

function revealHigherSeriesForTransition(index) {
  const transition = state.evidence?.transitions[index];
  if (!transition || transition.finalN <= 5 || state.includeHigherSeries) return;
  state.includeHigherSeries = true;
  higherSeriesControl.checked = true;
  syncSeriesLedgerMode();
}

function bindEvents() {
  transitionSelector.addEventListener("change", () => {
    const index = Number(transitionSelector.value);
    revealHigherSeriesForTransition(index);
    updateSelection(index);
    outputs.atlasStatus.textContent = atlasStatusText();
  });
  transitionCsvDownload.addEventListener("click", downloadTransitionCsv);

  transitionControls
    .querySelectorAll("[data-step-transition]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const nextIndex =
          state.selectedIndex + Number(button.dataset.stepTransition);
        revealHigherSeriesForTransition(
          ((nextIndex % state.evidence.transitions.length) +
            state.evidence.transitions.length) %
            state.evidence.transitions.length,
        );
        updateSelection(nextIndex);
        outputs.atlasStatus.textContent = atlasStatusText();
      });
    });

  document.querySelector("[data-series-filter]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-series]");
    if (button) chooseSeries(button.dataset.series);
  });

  document.querySelector("[data-series-ledger]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-ledger-series]");
    if (button) chooseSeries(button.dataset.ledgerSeries);
  });

  higherSeriesControl.addEventListener("change", () => {
    state.includeHigherSeries = higherSeriesControl.checked;
    syncSeriesLedgerMode();
    if (!state.includeHigherSeries && state.activeSeries === "Higher series") {
      state.activeSeries = "All";
      syncSeriesControls();
    }
    const candidates = filteredTransitions();
    if (
      candidates.length &&
      !candidates.some((transition) => transition.index === state.selectedIndex)
    ) {
      updateSelection(candidates[0].index, { announce: false });
    } else {
      drawAtlasChart();
    }
    outputs.atlasStatus.textContent = atlasStatusText(candidates);
  });

  chartCanvas.addEventListener("pointermove", handleChartPointerMove, {
    passive: true,
  });
  chartCanvas.addEventListener("pointerleave", () => {
    tooltip.hidden = true;
    state.hoveredIndex = null;
    chartCanvas.style.cursor = "crosshair";
  });
  chartCanvas.addEventListener("click", handleChartClick);
  chartCanvas.addEventListener("keydown", handleChartKeydown);
  stageCanvas.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    updateSelection(
      state.selectedIndex + (event.key === "ArrowRight" ? 1 : -1),
    );
  });

  const resizeObserver = new ResizeObserver(() => {
    drawEnergyStage();
    drawAtlasChart();
  });
  resizeObserver.observe(stageCanvas);
  resizeObserver.observe(chartCanvas);

  window.addEventListener("task05:display-mode", () => {
    tooltip.hidden = true;
    state.hoveredIndex = null;
    requestAnimationFrame(drawAtlasChart);
  });

  window.addEventListener(
    "pagehide",
    () => {
      resizeObserver.disconnect();
    },
    { once: true },
  );
}

function showFailure(error) {
  document.documentElement.dataset.task05Status = "error";
  instrument.classList.remove("is-loading");
  atlas.classList.remove("is-loading");
  document.querySelector("[data-instrument-loading]").hidden = true;
  document.querySelector("[data-instrument-error]").hidden = false;
  document.querySelector("[data-atlas-error]").hidden = false;
  outputs.regionBadge.textContent = "Data unavailable";
  outputs.atlasStatus.textContent = "Catalogue unavailable";
  disableControls();
  console.error("Task 5 evidence load failed", error);
}

async function initialise() {
  try {
    state.evidence = await loadTask05Evidence();
    populateTransitionSelector();
    populateSeriesLedger();
    populateLimitLedger();
    populateBalmerInstrument();
    populateValidationEvidence();
    bindEvents();
    enableControls();

    const defaultTransition = state.evidence.transitions.find(
      (transition) => transition.initialN === 3 && transition.finalN === 2,
    );
    state.selectedIndex = defaultTransition?.index ?? 0;
    instrument.classList.remove("is-loading");
    atlas.classList.remove("is-loading");
    document.querySelector("[data-instrument-loading]").hidden = true;
    document.documentElement.dataset.task05Status = "ready";
    updateSelection(state.selectedIndex, { announce: false });
    outputs.atlasStatus.textContent = atlasStatusText();
    window.dispatchEvent(new CustomEvent("task05:ready"));
  } catch (error) {
    showFailure(error);
  }
}

initialise();
