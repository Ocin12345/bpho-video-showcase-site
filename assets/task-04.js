const PLANCK_EV_NM = 1239.8419843320026;
const PLANCK_EV_S = 4.135667696923859e-15;
const PLANCK_J_S = 6.62607015e-34;
const ELECTRON_VOLT_J = 1.602176634e-19;
const SPEED_OF_LIGHT = 299792458;

const materials = {
  Silver: { symbol: "Ag", workFunction: 4.30, tone: "#6d7f89" },
  Aluminium: { symbol: "Al", workFunction: 4.30, tone: "#8f9ba3" },
  Gold: { symbol: "Au", workFunction: 5.10, tone: "#9b751c" },
  Copper: { symbol: "Cu", workFunction: 4.70, tone: "#b84f36" },
  Tin: { symbol: "Sn", workFunction: 4.40, tone: "#557c83" },
  Lead: { symbol: "Pb", workFunction: 4.30, tone: "#5d6170" },
  Tungsten: { symbol: "W", workFunction: 4.50, tone: "#4a4f5a" },
  Nickel: { symbol: "Ni", workFunction: 4.60, tone: "#2c806c" },
  Sodium: { symbol: "Na", workFunction: 2.40, tone: "#167a61" },
};

const materialOrder = ["Silver", "Aluminium", "Gold", "Copper", "Tin", "Lead", "Tungsten", "Nickel", "Sodium"];
const graphMaterials = ["Silver", "Gold", "Copper", "Sodium"];

const scenes = [
  {
    title: "Threshold",
    state: "Photon energy below Φ",
    caption: "Below threshold: the light arrives, but no electron leaves the surface.",
    note: "The light is present, but each photon is still short of the work function.",
  },
  {
    title: "Energy",
    state: "Electrons are emitted",
    caption: "Above threshold: the extra photon energy becomes the electron's kinetic energy.",
    note: "Changing wavelength changes the energy carried by each photon.",
  },
  {
    title: "Stopping",
    state: "Current approaches zero",
    caption: "A reverse collector bias turns back the fastest electrons at the stopping voltage.",
    note: "At zero current, eVs is the maximum kinetic energy—not the brightness of the beam.",
  },
  {
    title: "Compare",
    state: "Same gradient, different intercept",
    caption: "Across metals, the frequency gradient is shared while the work function shifts the intercept.",
    note: "The family of straight lines is the route back to h.",
  },
];

const state = {
  scene: 0,
  material: "Sodium",
  wavelength: 540,
  intensity: 48,
  voltage: 0,
  playing: false,
  sceneStartedAt: performance.now(),
  lastFrame: performance.now(),
  visible: true,
  frame: 0,
};

const canvas = document.querySelector("#photoelectric-canvas");
const graphCanvas = document.querySelector("#comparison-canvas");
const playButton = document.querySelector("[data-play]");
const playLabel = playButton?.querySelector("span");
const sceneButtons = [...document.querySelectorAll("[data-scene]")];
const materialSelect = document.querySelector("[data-material]");
const wavelengthInput = document.querySelector("[data-wavelength]");
const intensityInput = document.querySelector("[data-intensity]");
const voltageInput = document.querySelector("[data-voltage]");
const wavelengthOutput = document.querySelector("[data-wavelength-output]");
const intensityOutput = document.querySelector("[data-intensity-output]");
const voltageOutput = document.querySelector("[data-voltage-output]");
const sceneLabel = document.querySelector("[data-scene-label]");
const stageState = document.querySelector("[data-stage-state]");
const sceneTitle = document.querySelector("[data-scene-title]");
const sceneCaption = document.querySelector("[data-scene-caption]");
const stageProgress = document.querySelector("[data-stage-progress]");
const sequenceStatus = document.querySelector("[data-sequence-status]");
const railNote = document.querySelector("[data-rail-note]");
const thresholdOutput = document.querySelector("[data-threshold]");
const photonEnergyOutput = document.querySelector("[data-photon-energy]");
const kineticEnergyOutput = document.querySelector("[data-kinetic-energy]");
const currentOutput = document.querySelector("[data-current]");
const materialStrip = document.querySelector("[data-material-strip]");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const context = canvas?.getContext("2d");
const graphContext = graphCanvas?.getContext("2d");

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function frequencyFromWavelength(wavelength) {
  return SPEED_OF_LIGHT / (wavelength * 1e-9);
}

function thresholdWavelength(material) {
  return PLANCK_EV_NM / materials[material].workFunction;
}

function stateFor() {
  const workFunction = materials[state.material].workFunction;
  const photonEnergy = PLANCK_EV_NM / state.wavelength;
  const kineticEnergy = Math.max(0, photonEnergy - workFunction);
  const emits = kineticEnergy > 0;
  let currentFactor = 0;

  if (emits) {
    currentFactor = state.voltage < 0
      ? 0.78 * Math.max(0, 1 + state.voltage / kineticEnergy)
      : Math.min(1, 0.78 + 0.22 * (1 - Math.exp(-state.voltage / 1.35)));
  }

  return {
    workFunction,
    photonEnergy,
    kineticEnergy,
    emits,
    current: emits ? state.intensity * 0.18 * currentFactor : 0,
    threshold: thresholdWavelength(state.material),
  };
}

function formatSignedVoltage(value) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)} V`;
}

function setCanvasSize(target, targetContext) {
  if (!target || !targetContext) return null;
  const bounds = target.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(bounds.width));
  const height = Math.max(1, Math.round(bounds.height));
  const pixelWidth = Math.round(width * ratio);
  const pixelHeight = Math.round(height * ratio);

  if (target.width !== pixelWidth || target.height !== pixelHeight) {
    target.width = pixelWidth;
    target.height = pixelHeight;
  }

  targetContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { width, height };
}

function roundedRectangle(targetContext, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  targetContext.beginPath();
  targetContext.moveTo(x + safeRadius, y);
  targetContext.arcTo(x + width, y, x + width, y + height, safeRadius);
  targetContext.arcTo(x + width, y + height, x, y + height, safeRadius);
  targetContext.arcTo(x, y + height, x, y, safeRadius);
  targetContext.arcTo(x, y, x + width, y, safeRadius);
  targetContext.closePath();
}

function drawText(targetContext, text, x, y, options = {}) {
  targetContext.save();
  targetContext.fillStyle = options.color || "#24231f";
  targetContext.font = options.font || '12px "DM Mono", monospace';
  targetContext.textAlign = options.align || "left";
  targetContext.textBaseline = options.baseline || "alphabetic";
  targetContext.fillText(text, x, y);
  targetContext.restore();
}

function drawArrow(targetContext, x1, y1, x2, y2, color, width = 1) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  targetContext.save();
  targetContext.strokeStyle = color;
  targetContext.fillStyle = color;
  targetContext.lineWidth = width;
  targetContext.beginPath();
  targetContext.moveTo(x1, y1);
  targetContext.lineTo(x2, y2);
  targetContext.stroke();
  targetContext.beginPath();
  targetContext.moveTo(x2, y2);
  targetContext.lineTo(x2 - 8 * Math.cos(angle - Math.PI / 6), y2 - 8 * Math.sin(angle - Math.PI / 6));
  targetContext.lineTo(x2 - 8 * Math.cos(angle + Math.PI / 6), y2 - 8 * Math.sin(angle + Math.PI / 6));
  targetContext.closePath();
  targetContext.fill();
  targetContext.restore();
}

function wavelengthColor(wavelength) {
  if (wavelength < 380) return "#6b5aa8";
  if (wavelength < 440) return "#536faf";
  if (wavelength < 490) return "#3c85ad";
  if (wavelength < 510) return "#328e7c";
  if (wavelength < 580) return "#7b9a48";
  if (wavelength < 645) return "#b78932";
  return "#a35a43";
}

function drawPhoton(targetContext, x, y, progress, color, opacity = 1) {
  targetContext.save();
  targetContext.globalAlpha = opacity;
  targetContext.strokeStyle = color;
  targetContext.lineWidth = 2;
  targetContext.beginPath();
  for (let index = 0; index < 18; index += 1) {
    const pointX = x + index * 4;
    const pointY = y + Math.sin(index * 1.3 + progress * 7) * 3;
    if (index === 0) targetContext.moveTo(pointX, pointY);
    else targetContext.lineTo(pointX, pointY);
  }
  targetContext.stroke();
  targetContext.restore();
}

function drawElectron(targetContext, x, y, color, opacity = 1) {
  targetContext.save();
  targetContext.globalAlpha = opacity;
  targetContext.fillStyle = color;
  targetContext.beginPath();
  targetContext.arc(x, y, 4, 0, Math.PI * 2);
  targetContext.fill();
  targetContext.restore();
}

function drawStage(time) {
  const dimensions = setCanvasSize(canvas, context);
  if (!dimensions) return;
  const { width, height } = dimensions;
  const values = stateFor();
  const color = wavelengthColor(state.wavelength);
  const materialColor = materials[state.material].tone;
  const isCompact = width < 600;
  const cathodeX = width * (isCompact ? 0.42 : 0.40);
  const collectorX = width * (isCompact ? 0.70 : 0.72);
  const plateTop = height * 0.27;
  const plateBottom = height * 0.70;
  const centerY = (plateTop + plateBottom) / 2;
  const phase = (time - state.sceneStartedAt) / 1000;

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#f7f3eb";
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "rgba(200, 193, 181, 0.42)";
  context.lineWidth = 1;
  for (let y = 35; y < height; y += 35) {
    context.beginPath();
    context.moveTo(0, y + 0.5);
    context.lineTo(width, y + 0.5);
    context.stroke();
  }

  const sourceX = Math.max(40, width * 0.09);
  const sourceY = centerY - 38;
  roundedRectangle(context, sourceX - 35, sourceY - 29, 70, 58, 2);
  context.fillStyle = "#24231f";
  context.fill();
  context.fillStyle = "#f7f3eb";
  context.fillRect(sourceX - 20, sourceY - 13, 40, 26);
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(sourceX - 13, sourceY + 8);
  context.lineTo(sourceX - 2, sourceY - 8);
  context.lineTo(sourceX + 7, sourceY + 8);
  context.lineTo(sourceX + 18, sourceY - 8);
  context.stroke();
  drawText(context, "photon source", sourceX, sourceY + 54, { align: "center", color: "#706d66", font: '10px "DM Mono", monospace' });

  context.strokeStyle = "#c8c1b5";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(sourceX + 37, centerY);
  context.lineTo(cathodeX - 28, centerY);
  context.stroke();

  const photonCount = isCompact ? 4 : 6;
  for (let index = 0; index < photonCount; index += 1) {
    const offset = ((phase * 0.34 + index / photonCount) % 1) * Math.max(20, cathodeX - sourceX - 55);
    drawPhoton(context, sourceX + 43 + offset, centerY - 13 + Math.sin(index * 1.7) * 24, phase + index, color, 0.52 + (index % 2) * 0.2);
  }
  drawText(context, `${state.wavelength} nm`, (sourceX + cathodeX) / 2, centerY - 48, { align: "center", color, font: '12px "DM Mono", monospace' });

  context.strokeStyle = materialColor;
  context.lineWidth = isCompact ? 8 : 11;
  context.beginPath();
  context.moveTo(cathodeX, plateTop);
  context.lineTo(cathodeX, plateBottom);
  context.stroke();
  drawText(context, `${state.material} cathode`, cathodeX, plateBottom + 31, { align: "center", color: materialColor, font: '11px "DM Mono", monospace' });
  drawText(context, `Φ = ${values.workFunction.toFixed(2)} eV`, cathodeX, plateBottom + 48, { align: "center", color: "#706d66", font: '10px "DM Mono", monospace' });

  context.strokeStyle = "#24231f";
  context.lineWidth = isCompact ? 8 : 11;
  context.beginPath();
  context.moveTo(collectorX, plateTop + 12);
  context.lineTo(collectorX, plateBottom - 12);
  context.stroke();
  drawText(context, "collector", collectorX, plateBottom + 31, { align: "center", color: "#24231f", font: '11px "DM Mono", monospace' });

  context.setLineDash([4, 5]);
  context.strokeStyle = "#c8c1b5";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(cathodeX + 25, centerY);
  context.lineTo(collectorX - 25, centerY);
  context.stroke();
  context.setLineDash([]);

  if (values.emits) {
    const reverse = state.voltage < 0;
    const travel = reverse ? clamp(0.45 + state.voltage / Math.max(values.kineticEnergy, 0.05) * -0.18, 0.12, 0.78) : 0.92;
    const electronCount = isCompact ? 5 : 8;
    for (let index = 0; index < electronCount; index += 1) {
      const electronProgress = reverse
        ? clamp((phase * 0.22 + index / electronCount) % 1, 0, 1) * travel
        : (phase * 0.24 + index / electronCount) % 1;
      const x = cathodeX + 22 + (collectorX - cathodeX - 44) * electronProgress;
      const y = centerY + Math.sin(index * 2.1 + phase * 3) * (isCompact ? 43 : 62);
      drawElectron(context, x, y, reverse ? "#a27624" : "#226b58", 0.55 + (index % 3) * 0.15);
    }
    drawArrow(context, cathodeX + 30, centerY + 83, collectorX - 30, centerY + 83, reverse ? "#a27624" : "#226b58", 1);
    drawText(context, reverse ? "reverse bias" : "photoelectrons", (cathodeX + collectorX) / 2, centerY + 110, { align: "center", color: reverse ? "#755316" : "#226b58", font: '11px "DM Mono", monospace' });
  } else {
    context.strokeStyle = "#b8b0a4";
    context.lineWidth = 1;
    context.setLineDash([3, 5]);
    context.beginPath();
    context.moveTo(cathodeX + 26, centerY - 65);
    context.lineTo(cathodeX + 26, centerY + 65);
    context.stroke();
    context.setLineDash([]);
    drawText(context, "no emission", cathodeX + 56, centerY + 5, { color: "#706d66", font: '11px "DM Mono", monospace' });
  }

  const meterX = width * (isCompact ? 0.87 : 0.88);
  const meterY = height * 0.22;
  const meterWidth = Math.min(106, width * 0.14);
  const meterHeight = 84;
  roundedRectangle(context, meterX - meterWidth / 2, meterY, meterWidth, meterHeight, 2);
  context.fillStyle = "#fff";
  context.fill();
  context.strokeStyle = "#c8c1b5";
  context.stroke();
  drawText(context, "I", meterX, meterY + 25, { align: "center", color: "#706d66", font: '12px "DM Mono", monospace' });
  drawText(context, `${values.current.toFixed(1)} nA`, meterX, meterY + 50, { align: "center", color: values.current < 1 ? "#a27624" : "#226b58", font: '12px "DM Mono", monospace' });
  drawText(context, "picoammeter", meterX, meterY + meterHeight + 19, { align: "center", color: "#706d66", font: '9px "DM Mono", monospace' });

  const voltageY = height - 36;
  const voltageBoxWidth = Math.min(190, width * 0.27);
  roundedRectangle(context, width - voltageBoxWidth - 20, voltageY - 22, voltageBoxWidth, 32, 2);
  context.fillStyle = "#fff";
  context.fill();
  context.strokeStyle = "#c8c1b5";
  context.stroke();
  drawText(context, `Vᶜ ${formatSignedVoltage(state.voltage)}`, width - voltageBoxWidth / 2 - 20, voltageY - 1, { align: "center", color: state.voltage < 0 ? "#755316" : "#706d66", font: '11px "DM Mono", monospace' });

  if (state.scene === 0) {
    drawText(context, "hf < Φ", cathodeX, plateTop - 27, { align: "center", color: "#755316", font: '15px "Cormorant Garamond", Georgia, serif' });
  } else if (state.scene === 1 || state.scene === 2) {
    drawText(context, `hf = ${values.photonEnergy.toFixed(2)} eV`, cathodeX, plateTop - 27, { align: "center", color: "#226b58", font: '15px "Cormorant Garamond", Georgia, serif' });
    drawText(context, `Kmax = ${values.kineticEnergy.toFixed(2)} eV`, collectorX, plateTop - 27, { align: "center", color: "#755316", font: '15px "Cormorant Garamond", Georgia, serif' });
  } else {
    drawText(context, "Vₛ ∝ f", (cathodeX + collectorX) / 2, plateTop - 27, { align: "center", color: "#755316", font: '15px "Cormorant Garamond", Georgia, serif' });
  }
}

function xScale(value, left, right, minimum, maximum) {
  return left + ((value - minimum) / (maximum - minimum)) * (right - left);
}

function yScale(value, top, bottom, minimum, maximum) {
  return bottom - ((value - minimum) / (maximum - minimum)) * (bottom - top);
}

function drawGraph() {
  const dimensions = setCanvasSize(graphCanvas, graphContext);
  if (!dimensions) return;
  const { width, height } = dimensions;
  const compact = width < 620;
  const left = compact ? 49 : 68;
  const right = width - (compact ? 18 : 31);
  const top = 30;
  const bottom = height - 48;
  const minimumFrequency = 5;
  const maximumFrequency = 18;
  const maximumVoltage = 5.5;
  const selectedTone = materials[state.material].tone;

  graphContext.clearRect(0, 0, width, height);
  graphContext.fillStyle = "#f7f3eb";
  graphContext.fillRect(0, 0, width, height);
  graphContext.strokeStyle = "rgba(200, 193, 181, 0.56)";
  graphContext.lineWidth = 1;

  for (let voltage = 0; voltage <= 5; voltage += 1) {
    const y = yScale(voltage, top, bottom, 0, maximumVoltage);
    graphContext.beginPath();
    graphContext.moveTo(left, y + 0.5);
    graphContext.lineTo(right, y + 0.5);
    graphContext.stroke();
    drawText(graphContext, String(voltage), left - 10, y + 4, { align: "right", color: "#706d66", font: '10px "DM Mono", monospace' });
  }

  for (let frequency = 6; frequency <= 18; frequency += 2) {
    const x = xScale(frequency, left, right, minimumFrequency, maximumFrequency);
    graphContext.beginPath();
    graphContext.moveTo(x + 0.5, top);
    graphContext.lineTo(x + 0.5, bottom);
    graphContext.stroke();
    drawText(graphContext, String(frequency), x, bottom + 18, { align: "center", color: "#706d66", font: '10px "DM Mono", monospace' });
  }

  graphContext.strokeStyle = "#24231f";
  graphContext.lineWidth = 1.2;
  graphContext.beginPath();
  graphContext.moveTo(left, top);
  graphContext.lineTo(left, bottom);
  graphContext.lineTo(right, bottom);
  graphContext.stroke();
  drawText(graphContext, "Vₛ / V", left, top - 11, { color: "#24231f", font: '11px "DM Mono", monospace' });
  drawText(graphContext, "f / 10¹⁴ Hz", right, bottom + 38, { align: "right", color: "#24231f", font: '11px "DM Mono", monospace' });

  for (const material of materialOrder) {
    const item = materials[material];
    const thresholdFrequency = item.workFunction / PLANCK_EV_S / 1e14;
    const start = Math.max(minimumFrequency, thresholdFrequency);
    const end = maximumFrequency;
    if (start >= end) continue;
    const selected = material === state.material;
    graphContext.strokeStyle = item.tone;
    graphContext.globalAlpha = selected ? 1 : (graphMaterials.includes(material) ? 0.68 : 0.23);
    graphContext.lineWidth = selected ? 3 : (graphMaterials.includes(material) ? 1.8 : 1);
    graphContext.beginPath();
    for (let frequency = start; frequency <= end; frequency += 0.08) {
      const voltage = PLANCK_EV_S * frequency * 1e14 - item.workFunction;
      const x = xScale(frequency, left, right, minimumFrequency, maximumFrequency);
      const y = yScale(voltage, top, bottom, 0, maximumVoltage);
      if (frequency === start) graphContext.moveTo(x, y);
      else graphContext.lineTo(x, y);
    }
    graphContext.stroke();
    graphContext.globalAlpha = 1;
  }

  const values = stateFor();
  if (values.emits) {
    const frequency = frequencyFromWavelength(state.wavelength) / 1e14;
    const voltage = values.kineticEnergy;
    if (frequency >= minimumFrequency && frequency <= maximumFrequency && voltage <= maximumVoltage) {
      const x = xScale(frequency, left, right, minimumFrequency, maximumFrequency);
      const y = yScale(voltage, top, bottom, 0, maximumVoltage);
      graphContext.fillStyle = selectedTone;
      graphContext.beginPath();
      graphContext.arc(x, y, 5, 0, Math.PI * 2);
      graphContext.fill();
      drawText(graphContext, "current point", x + 10, y - 9, { color: selectedTone, font: '10px "DM Mono", monospace' });
    }
  }
}

function renderLegend() {
  const legend = document.querySelector("[data-legend]");
  if (!legend) return;
  legend.innerHTML = graphMaterials.map((material) => `<span style="color:${materials[material].tone}"><i></i>${materials[material].symbol} ${material}</span>`).join("");
}

function renderMaterialStrip() {
  if (!materialStrip) return;
  materialStrip.innerHTML = materialOrder.map((material) => `<span style="border-left: 3px solid ${materials[material].tone}"><strong>${materials[material].symbol}</strong> ${material}</span>`).join("");
}

function updateReadings() {
  const values = stateFor();
  wavelengthOutput.textContent = `${state.wavelength} nm`;
  intensityOutput.textContent = `${state.intensity}%`;
  voltageOutput.textContent = formatSignedVoltage(state.voltage);
  thresholdOutput.textContent = `${values.threshold.toFixed(1)} nm`;
  photonEnergyOutput.textContent = `${values.photonEnergy.toFixed(2)} eV`;
  kineticEnergyOutput.textContent = values.emits ? `${values.kineticEnergy.toFixed(3)} eV` : "—";
  currentOutput.textContent = `${values.current.toFixed(1)} nA`;
  sceneLabel.textContent = `${String(state.scene + 1).padStart(2, "0")} / ${scenes[state.scene].title}`;
  stageState.textContent = scenes[state.scene].state;
  sceneTitle.textContent = scenes[state.scene].title;
  sceneCaption.textContent = scenes[state.scene].caption;
  railNote.textContent = scenes[state.scene].note;

  sceneButtons.forEach((button, index) => {
    button.setAttribute("aria-selected", String(index === state.scene));
  });
}

function render() {
  updateReadings();
  drawStage(state.frame);
  drawGraph();
}

function presetForScene(index) {
  const threshold = thresholdWavelength(state.material);
  if (index === 0) {
    return { wavelength: clamp(Math.round(threshold + 24), 200, 700), intensity: 48, voltage: 0 };
  }
  if (index === 1) {
    return { wavelength: clamp(Math.round(threshold - 68), 200, 700), intensity: 48, voltage: 0 };
  }
  if (index === 2) {
    const wavelength = clamp(Math.round(threshold - 68), 200, 700);
    const kineticEnergy = Math.max(0, PLANCK_EV_NM / wavelength - materials[state.material].workFunction);
    return { wavelength, intensity: 48, voltage: -kineticEnergy };
  }
  return { wavelength: 450, intensity: 72, voltage: 0 };
}

function setScene(index, usePreset = true) {
  state.scene = clamp(index, 0, scenes.length - 1);
  state.sceneStartedAt = performance.now();
  if (usePreset) Object.assign(state, presetForScene(state.scene));
  wavelengthInput.value = String(Math.round(state.wavelength));
  intensityInput.value = String(Math.round(state.intensity));
  voltageInput.value = String(state.voltage);
  render();
}

function setPlaying(playing) {
  state.playing = playing;
  state.sceneStartedAt = performance.now();
  playButton.classList.toggle("is-playing", playing);
  playLabel.textContent = playing ? "Pause the cut" : "Play the cut";
  playButton.querySelector("path").setAttribute("d", playing ? "M7 5h4v14H7zM13 5h4v14h-4z" : "M8 5l11 7-11 7z");
  sequenceStatus.textContent = playing
    ? `Playing — ${String(state.scene + 1).padStart(2, "0")} / 04 ${scenes[state.scene].title.toLowerCase()}.`
    : `Paused — ${String(state.scene + 1).padStart(2, "0")} / 04 ${scenes[state.scene].title.toLowerCase()}.`;
}

function animationFrame(time) {
  state.frame = time;
  const elapsed = time - state.lastFrame;
  state.lastFrame = time;

  if (state.visible && !reduceMotion.matches) {
    if (state.playing && time - state.sceneStartedAt > 3100) {
      const nextScene = (state.scene + 1) % scenes.length;
      setScene(nextScene, true);
      sequenceStatus.textContent = `Playing — ${String(nextScene + 1).padStart(2, "0")} / 04 ${scenes[nextScene].title.toLowerCase()}.`;
    }
    if (elapsed < 1000) render();
  }
  window.requestAnimationFrame(animationFrame);
}

sceneButtons.forEach((button, index) => {
  button.addEventListener("click", () => {
    setScene(index, true);
    setPlaying(false);
    sequenceStatus.textContent = `Paused — ${String(index + 1).padStart(2, "0")} / 04 ${scenes[index].title.toLowerCase()}.`;
  });
});

playButton?.addEventListener("click", () => setPlaying(!state.playing));

materialSelect?.addEventListener("change", (event) => {
  state.material = event.currentTarget.value;
  setScene(state.scene, true);
});

wavelengthInput?.addEventListener("input", (event) => {
  state.wavelength = Number(event.currentTarget.value);
  render();
});

intensityInput?.addEventListener("input", (event) => {
  state.intensity = Number(event.currentTarget.value);
  render();
});

voltageInput?.addEventListener("input", (event) => {
  state.voltage = Number(event.currentTarget.value);
  render();
});

const observer = new IntersectionObserver(([entry]) => {
  state.visible = entry.isIntersecting;
}, { threshold: 0.05 });

if (canvas) observer.observe(canvas);

window.addEventListener("resize", render);
document.addEventListener("visibilitychange", () => {
  state.visible = document.visibilityState === "visible";
});

if (reduceMotion.addEventListener) {
  reduceMotion.addEventListener("change", render);
}

renderLegend();
renderMaterialStrip();
setScene(0, true);
window.requestAnimationFrame(animationFrame);
