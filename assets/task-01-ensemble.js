const form = document.querySelector("[data-ensemble-form]");
const pathsCanvas = document.querySelector("#ensemble-paths-canvas");
const endpointsCanvas = document.querySelector("#ensemble-endpoints-canvas");
const pathsContext = pathsCanvas.getContext("2d");
const endpointsContext = endpointsCanvas.getContext("2d");
const walkCountInput = document.querySelector("#ensemble-walk-count");
const stepCountInput = document.querySelector("#ensemble-step-count");
const stepSizeInput = document.querySelector("#ensemble-step-size");
const seedInput = document.querySelector("#ensemble-seed");
const runButton = document.querySelector("[data-run-ensemble]");
const downloadButton = document.querySelector("[data-download-ensemble]");
const exportButton = document.querySelector("[data-export-ensemble]");
const statusOutput = document.querySelector("[data-ensemble-status]");
const methodOutput = document.querySelector("[data-ensemble-method]");
const progressBar = document.querySelector("[data-ensemble-progress]");
const pathCaption = document.querySelector("[data-ensemble-path-caption]");
const endpointCaption = document.querySelector(
  "[data-ensemble-endpoint-caption]",
);
const laboratory = document.querySelector("[data-ensemble-laboratory]");
const errorOutput = document.querySelector("[data-ensemble-error-message]");
const emptyOutput = document.querySelector("[data-ensemble-empty]");

const outputs = {
  mean: document.querySelector("[data-ensemble-mean]"),
  rms: document.querySelector("[data-ensemble-rms]"),
  rmsTheory: document.querySelector("[data-ensemble-rms-theory]"),
  error: document.querySelector("[data-ensemble-error]"),
};

const TAU = Math.PI * 2;
const MAX_DISPLAYED_PATHS = 50;
const MAX_POINTS_PER_PATH = 650;
const MAX_EXACT_MICROSCOPIC_STEPS = 20_000_000;
const MAX_RENDERED_ENDPOINTS = 25_000;
const PATH_COLOURS = [
  [67, 56, 134],
  [47, 103, 178],
  [28, 150, 143],
  [112, 167, 73],
  [226, 163, 54],
  [220, 91, 72],
  [181, 55, 118],
];

let latestResult = null;
let activeRun = 0;
let resizeFrame = 0;

function mulberry32(seed) {
  let value = seed >>> 0;
  return function random() {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function normalPair(random) {
  const u = Math.max(random(), Number.EPSILON);
  const v = random();
  const magnitude = Math.sqrt(-2 * Math.log(u));
  return [
    magnitude * Math.cos(TAU * v),
    magnitude * Math.sin(TAU * v),
  ];
}

function clampedNumber(input, fallback) {
  const value = Number(input.value);
  const finiteValue = Number.isFinite(value) ? value : fallback;
  return Math.min(Number(input.max), Math.max(Number(input.min), finiteValue));
}

function validatedParameters() {
  const nWalks = Math.round(clampedNumber(walkCountInput, 200));
  const nSteps = Math.round(clampedNumber(stepCountInput, 1000));
  const stepSize = clampedNumber(stepSizeInput, 1);
  const seed = Math.trunc(clampedNumber(seedInput, 2026));

  walkCountInput.value = String(nWalks);
  stepCountInput.value = String(nSteps);
  stepSizeInput.value = String(stepSize);
  seedInput.value = String(seed);
  return { nWalks, nSteps, stepSize, seed };
}

function modeForParameters({ nWalks, nSteps }) {
  return nWalks * nSteps <= MAX_EXACT_MICROSCOPIC_STEPS
    ? "exact"
    : "multiscale";
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function formatMeasurement(value) {
  const magnitude = Math.abs(value);
  if (magnitude >= 1_000_000 || (magnitude > 0 && magnitude < 0.001)) {
    return value.toExponential(3);
  }
  return value.toLocaleString(undefined, {
    maximumFractionDigits: magnitude < 10 ? 3 : 2,
  });
}

async function simulateEnsemble(parameters, runId) {
  const { nWalks, nSteps, stepSize, seed } = parameters;
  const mode = modeForParameters(parameters);
  const random = mulberry32(seed);
  const endpointX = new Float64Array(nWalks);
  const endpointY = new Float64Array(nWalks);
  const displayedPaths = [];
  const pathCount = Math.min(MAX_DISPLAYED_PATHS, nWalks);
  const sampleInterval =
    mode === "exact"
      ? Math.max(1, Math.ceil(nSteps / MAX_POINTS_PER_PATH))
      : null;
  const blockCount =
    mode === "multiscale"
      ? Math.min(MAX_POINTS_PER_PATH, nSteps)
      : null;
  const walksPerFrame =
    mode === "exact"
      ? Math.max(1, Math.min(40, Math.floor(250_000 / nSteps)))
      : 750;
  const endpointSigma = stepSize * Math.sqrt(nSteps / 2);

  let sumX = 0;
  let sumY = 0;
  let sumR2 = 0;
  let maxAbsEndpoint = 0;

  for (let walk = 0; walk < nWalks; walk += 1) {
    let x = 0;
    let y = 0;
    const path = walk < pathCount ? [0, 0] : null;

    if (mode === "exact") {
      for (let step = 1; step <= nSteps; step += 1) {
        const theta = random() * TAU;
        x += stepSize * Math.cos(theta);
        y += stepSize * Math.sin(theta);

        if (
          path &&
          (step % sampleInterval === 0 || step === nSteps)
        ) {
          path.push(x, y);
        }
      }
    } else if (path) {
      let completedSteps = 0;
      for (let block = 1; block <= blockCount; block += 1) {
        const targetStep = Math.round((block * nSteps) / blockCount);
        const microscopicSteps = targetStep - completedSteps;
        const blockSigma = stepSize * Math.sqrt(microscopicSteps / 2);
        const [normalX, normalY] = normalPair(random);
        x += blockSigma * normalX;
        y += blockSigma * normalY;
        completedSteps = targetStep;
        path.push(x, y);
      }
    } else {
      const [normalX, normalY] = normalPair(random);
      x = endpointSigma * normalX;
      y = endpointSigma * normalY;
    }

    if (path) displayedPaths.push(new Float32Array(path));
    endpointX[walk] = x;
    endpointY[walk] = y;
    sumX += x;
    sumY += y;
    sumR2 += x * x + y * y;
    maxAbsEndpoint = Math.max(maxAbsEndpoint, Math.abs(x), Math.abs(y));

    if ((walk + 1) % walksPerFrame === 0 || walk + 1 === nWalks) {
      const completed = walk + 1;
      const percentage = (completed / nWalks) * 100;
      progressBar.style.width = `${percentage}%`;
      statusOutput.textContent =
        completed === nWalks
          ? "Drawing statistical evidence"
          : `Calculating ${completed.toLocaleString()} of ${nWalks.toLocaleString()} walks`;
      await nextFrame();
      if (runId !== activeRun) return null;
    }
  }

  const meanX = sumX / nWalks;
  const meanY = sumY / nWalks;
  const measuredMsd = sumR2 / nWalks;
  const theoreticalMsd = nSteps * stepSize ** 2;

  return {
    ...parameters,
    mode,
    endpointX,
    endpointY,
    displayedPaths,
    meanX,
    meanY,
    measuredMsd,
    theoreticalMsd,
    measuredRms: Math.sqrt(measuredMsd),
    theoreticalRms: Math.sqrt(theoreticalMsd),
    relativeError: (measuredMsd - theoreticalMsd) / theoreticalMsd,
    maxAbsEndpoint,
  };
}

function canvasGeometry(canvas, context) {
  const width = Math.max(320, canvas.clientWidth);
  const height = Math.max(340, canvas.clientHeight);
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  return { width, height };
}

function niceGridStep(target) {
  const exponent = 10 ** Math.floor(Math.log10(Math.max(target, 1e-12)));
  const fraction = target / exponent;
  if (fraction <= 1) return exponent;
  if (fraction <= 2) return 2 * exponent;
  if (fraction <= 5) return 5 * exponent;
  return 10 * exponent;
}

function createPlot(canvas, context, extent) {
  const { width, height } = canvasGeometry(canvas, context);
  const margins = {
    top: 22,
    right: 22,
    bottom: 42,
    left: extent >= 1_000_000 ? 86 : 52,
  };
  const plotWidth = width - margins.left - margins.right;
  const plotHeight = height - margins.top - margins.bottom;
  const safeExtent = Math.max(extent, Number.EPSILON);
  const scale = Math.min(
    plotWidth / (safeExtent * 2),
    plotHeight / (safeExtent * 2),
  );
  const centreX = margins.left + plotWidth / 2;
  const centreY = margins.top + plotHeight / 2;
  const visibleX = plotWidth / (2 * scale);
  const visibleY = plotHeight / (2 * scale);
  const tick = niceGridStep((Math.min(visibleX, visibleY) * 2) / 6);

  const map = (x, y) => ({
    x: centreX + x * scale,
    y: centreY - y * scale,
  });

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#f6f2ea";
  context.fillRect(0, 0, width, height);

  const wash = context.createRadialGradient(
    centreX,
    centreY,
    0,
    centreX,
    centreY,
    Math.max(plotWidth, plotHeight) * 0.72,
  );
  wash.addColorStop(0, "rgba(182, 152, 93, 0.055)");
  wash.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = wash;
  context.fillRect(0, 0, width, height);

  context.font = '10px "Times New Roman", Times, serif';
  context.textBaseline = "middle";
  context.lineWidth = 1;

  const xLimit = Math.floor(visibleX / tick) * tick;
  const yLimit = Math.floor(visibleY / tick) * tick;

  for (let value = -xLimit; value <= xLimit + tick / 2; value += tick) {
    const point = map(value, 0);
    context.strokeStyle =
      Math.abs(value) < tick / 10
        ? "rgba(55, 50, 42, 0.25)"
        : "rgba(55, 50, 42, 0.07)";
    context.beginPath();
    context.moveTo(point.x, margins.top);
    context.lineTo(point.x, height - margins.bottom);
    context.stroke();

    if (Math.abs(value) > tick / 10) {
      context.fillStyle = "#797164";
      context.textAlign = "center";
      context.fillText(
        formatMeasurement(value),
        point.x,
        height - margins.bottom + 18,
      );
    }
  }

  for (let value = -yLimit; value <= yLimit + tick / 2; value += tick) {
    const point = map(0, value);
    context.strokeStyle =
      Math.abs(value) < tick / 10
        ? "rgba(55, 50, 42, 0.25)"
        : "rgba(55, 50, 42, 0.07)";
    context.beginPath();
    context.moveTo(margins.left, point.y);
    context.lineTo(width - margins.right, point.y);
    context.stroke();

    if (Math.abs(value) > tick / 10) {
      context.fillStyle = "#797164";
      context.textAlign = "right";
      context.fillText(
        formatMeasurement(value),
        margins.left - 9,
        point.y,
      );
    }
  }

  context.fillStyle = "#514b42";
  context.font = 'italic 17px "Times New Roman", Times, serif';
  context.textAlign = "right";
  context.fillText("x", width - margins.right, height - 17);
  context.textAlign = "left";
  context.fillText("y", 15, margins.top);

  context.save();
  context.beginPath();
  context.rect(
    margins.left,
    margins.top,
    plotWidth,
    plotHeight,
  );
  context.clip();
  return { width, height, scale, map, margins, plotWidth, plotHeight };
}

function finishPlot(context) {
  context.restore();
}

function colourForIndex(index, total, alpha) {
  const progress = total <= 1 ? 0.5 : index / (total - 1);
  const scaled = progress * (PATH_COLOURS.length - 1);
  const lowerIndex = Math.floor(scaled);
  const upperIndex = Math.min(PATH_COLOURS.length - 1, lowerIndex + 1);
  const blend = scaled - lowerIndex;
  const lower = PATH_COLOURS[lowerIndex];
  const upper = PATH_COLOURS[upperIndex];
  const channels = lower.map((value, channel) =>
    Math.round(value + (upper[channel] - value) * blend),
  );
  return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
}

function trajectoryExtent(paths, theoreticalRms) {
  let extent = theoreticalRms * 1.18;
  paths.forEach((path) => {
    for (let index = 0; index < path.length; index += 2) {
      extent = Math.max(extent, Math.abs(path[index]), Math.abs(path[index + 1]));
    }
  });
  return extent * 1.12;
}

function endpointExtent(result) {
  return Math.max(result.theoreticalRms * 1.3, result.maxAbsEndpoint) * 1.12;
}

function drawTrajectories(result) {
  const extent = trajectoryExtent(
    result.displayedPaths,
    result.theoreticalRms,
  );
  const plot = createPlot(pathsCanvas, pathsContext, extent);

  result.displayedPaths.forEach((path, pathIndex) => {
    pathsContext.strokeStyle = colourForIndex(
      pathIndex,
      result.displayedPaths.length,
      0.42,
    );
    pathsContext.lineWidth = 1.05;
    pathsContext.lineCap = "round";
    pathsContext.lineJoin = "round";
    pathsContext.beginPath();
    const origin = plot.map(path[0], path[1]);
    pathsContext.moveTo(origin.x, origin.y);
    for (let index = 2; index < path.length; index += 2) {
      const point = plot.map(path[index], path[index + 1]);
      pathsContext.lineTo(point.x, point.y);
    }
    pathsContext.stroke();
  });

  const origin = plot.map(0, 0);
  pathsContext.fillStyle = "#1b1b18";
  pathsContext.beginPath();
  pathsContext.arc(origin.x, origin.y, 4.2, 0, TAU);
  pathsContext.fill();
  finishPlot(pathsContext);
}

function drawEndpoints(result) {
  const plot = createPlot(
    endpointsCanvas,
    endpointsContext,
    endpointExtent(result),
  );
  const origin = plot.map(0, 0);

  endpointsContext.save();
  endpointsContext.setLineDash([7, 8]);
  endpointsContext.lineWidth = 1.35;
  endpointsContext.strokeStyle = "rgba(63, 100, 178, 0.76)";
  endpointsContext.beginPath();
  endpointsContext.arc(
    origin.x,
    origin.y,
    result.theoreticalRms * plot.scale,
    0,
    TAU,
  );
  endpointsContext.stroke();
  endpointsContext.restore();

  const endpointStride = Math.max(
    1,
    Math.ceil(result.nWalks / MAX_RENDERED_ENDPOINTS),
  );
  const renderedEndpoints = Math.ceil(result.nWalks / endpointStride);

  for (
    let index = 0;
    index < result.nWalks;
    index += endpointStride
  ) {
    const point = plot.map(result.endpointX[index], result.endpointY[index]);
    const angleProgress =
      (Math.atan2(result.endpointY[index], result.endpointX[index]) + Math.PI) /
      TAU;
    endpointsContext.fillStyle = colourForIndex(
      Math.round(angleProgress * 100),
      101,
      renderedEndpoints > 700 ? 0.42 : 0.68,
    );
    endpointsContext.beginPath();
    endpointsContext.arc(
      point.x,
      point.y,
      renderedEndpoints > 8_000 ? 1.25 : renderedEndpoints > 700 ? 2 : 2.7,
      0,
      TAU,
    );
    endpointsContext.fill();
  }

  const mean = plot.map(result.meanX, result.meanY);
  endpointsContext.strokeStyle = "#1b1b18";
  endpointsContext.lineWidth = 2;
  endpointsContext.beginPath();
  endpointsContext.moveTo(mean.x - 7, mean.y);
  endpointsContext.lineTo(mean.x + 7, mean.y);
  endpointsContext.moveTo(mean.x, mean.y - 7);
  endpointsContext.lineTo(mean.x, mean.y + 7);
  endpointsContext.stroke();
  endpointsContext.fillStyle = "#f6f2ea";
  endpointsContext.beginPath();
  endpointsContext.arc(mean.x, mean.y, 2.2, 0, TAU);
  endpointsContext.fill();
  finishPlot(endpointsContext);
}

function drawLatestResult() {
  if (!latestResult) return;
  drawTrajectories(latestResult);
  drawEndpoints(latestResult);
}

function updateResults(result) {
  outputs.mean.textContent =
    `(${formatMeasurement(result.meanX)}, ${formatMeasurement(result.meanY)})`;
  outputs.rms.textContent = formatMeasurement(result.measuredRms);
  outputs.rmsTheory.textContent = formatMeasurement(result.theoreticalRms);
  outputs.error.textContent =
    `${result.relativeError >= 0 ? "+" : "−"}${Math.abs(result.relativeError * 100).toFixed(2)}%`;
  pathCaption.textContent =
    `${result.displayedPaths.length.toLocaleString()} of ${result.nWalks.toLocaleString()} walks`;
  const renderedEndpoints = Math.min(
    result.nWalks,
    Math.ceil(
      result.nWalks /
        Math.max(1, Math.ceil(result.nWalks / MAX_RENDERED_ENDPOINTS)),
    ),
  );
  endpointCaption.textContent =
    renderedEndpoints === result.nWalks
      ? `${result.nWalks.toLocaleString()} endpoints`
      : `${renderedEndpoints.toLocaleString()} of ${result.nWalks.toLocaleString()} shown`;
  methodOutput.textContent =
    result.mode === "exact"
      ? "Every endpoint was produced from explicit fixed-length steps and a reproducible seed."
      : "Large runs use the Gaussian central-limit model for endpoint coordinates and multiscale path blocks; the theoretical moments remain Ns².";
}

async function runEnsemble() {
  const runId = ++activeRun;
  const parameters = validatedParameters();
  const requestedMode = modeForParameters(parameters);
  runButton.disabled = true;
  downloadButton.disabled = true;
  exportButton.disabled = true;
  laboratory.classList.add("is-loading");
  laboratory.classList.remove("has-error");
  errorOutput.hidden = true;
  emptyOutput.hidden = true;
  progressBar.style.width = "0%";
  statusOutput.textContent =
    requestedMode === "exact"
      ? "Starting simulation"
      : "Starting large-N approximation";
  await nextFrame();

  try {
    const result = await simulateEnsemble(parameters, runId);
    if (!result || runId !== activeRun) return;
    latestResult = result;
    drawLatestResult();
    updateResults(result);
    statusOutput.textContent =
      `${result.nWalks.toLocaleString()} walks complete`;
    progressBar.style.width = "100%";
    downloadButton.disabled = false;
    exportButton.disabled = false;
    laboratory.classList.remove("is-loading");
  } catch (error) {
    latestResult = null;
    laboratory.classList.remove("is-loading");
    laboratory.classList.add("has-error");
    errorOutput.hidden = false;
    errorOutput.textContent =
      error instanceof Error
        ? `The ensemble could not be completed: ${error.message}`
        : "The ensemble could not be completed. Check the parameters and try again.";
    emptyOutput.hidden = false;
    statusOutput.textContent = "Simulation incomplete";
    progressBar.style.width = "0%";
  } finally {
    if (runId === activeRun) runButton.disabled = false;
  }
}

function triggerDownload(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
}

function downloadCsv() {
  if (!latestResult) return;
  const rows = [
    "# Task 1 ensemble export",
    `# n_walks=${latestResult.nWalks}`,
    `# n_steps=${latestResult.nSteps}`,
    `# step_length=${latestResult.stepSize}`,
    `# master_seed=${latestResult.seed}`,
    `# method=${latestResult.mode}`,
    "walk,x,y,r,method",
  ];
  for (let index = 0; index < latestResult.nWalks; index += 1) {
    const x = latestResult.endpointX[index];
    const y = latestResult.endpointY[index];
    rows.push(
      `${index + 1},${x},${y},${Math.hypot(x, y)},${latestResult.mode}`,
    );
  }
  const blob = new Blob([`${rows.join("\n")}\n`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, `task01-ensemble-seed-${latestResult.seed}.csv`);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function exportFigure() {
  if (!latestResult) return;
  const exportCanvas = document.createElement("canvas");
  const width = 2400;
  const height = 1260;
  exportCanvas.width = width;
  exportCanvas.height = height;
  const context = exportCanvas.getContext("2d");
  context.fillStyle = "#f3eee4";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#211f1b";
  context.font = '700 64px "Times New Roman", Times, serif';
  context.fillText("Task 1 — Random-walk ensemble", 100, 102);
  context.fillStyle = "#686158";
  context.font = '32px "Times New Roman", Times, serif';
  context.fillText(
    `${latestResult.nWalks.toLocaleString()} walks · ${latestResult.nSteps.toLocaleString()} steps · s = ${latestResult.stepSize} · seed ${latestResult.seed} · ${latestResult.mode === "exact" ? "exact" : "multiscale CLT"}`,
    100,
    157,
  );
  context.drawImage(pathsCanvas, 80, 220, 1100, 760);
  context.drawImage(endpointsCanvas, 1220, 220, 1100, 760);
  context.fillStyle = "#211f1b";
  context.font = '36px "Times New Roman", Times, serif';
  context.fillText(
    `Measured RMS: ${formatMeasurement(latestResult.measuredRms)}`,
    100,
    1080,
  );
  context.fillText(
    `Theory: ${formatMeasurement(latestResult.theoreticalRms)}`,
    830,
    1080,
  );
  context.fillText(
    `MSD difference: ${latestResult.relativeError >= 0 ? "+" : "−"}${Math.abs(latestResult.relativeError * 100).toFixed(2)}%`,
    1430,
    1080,
  );
  context.fillStyle = "#686158";
  context.font = '26px "Times New Roman", Times, serif';
  context.fillText(
    latestResult.mode === "exact"
      ? "Every endpoint was generated from independent, uniformly distributed fixed-length steps."
      : "Large-N endpoints use the Gaussian central-limit approximation with the exact theoretical moments.",
    100,
    1160,
  );
  triggerDownload(
    exportCanvas.toDataURL("image/png"),
    `task01-ensemble-seed-${latestResult.seed}.png`,
  );
}

function scheduleRedraw() {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(drawLatestResult);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  runEnsemble();
});
downloadButton.addEventListener("click", downloadCsv);
exportButton.addEventListener("click", exportFigure);
window.addEventListener("resize", scheduleRedraw);
new ResizeObserver(scheduleRedraw).observe(
  document.querySelector(".ensemble-plots"),
);

runEnsemble();

if (document.fonts) {
  document.fonts.ready.then(scheduleRedraw);
}
