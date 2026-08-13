(() => {
const canvas = document.querySelector("#brownian-canvas");
const context = canvas.getContext("2d", { alpha: false });
const observatory = document.querySelector(".observatory");
const parameterDrawer = document.querySelector("#parameter-drawer");

const controls = {
  particleCount: document.querySelector("#particle-count"),
  temperature: document.querySelector("#gas-temperature"),
  massRatio: document.querySelector("#mass-ratio"),
  restitution: document.querySelector("#restitution"),
  knudsen: document.querySelector("#knudsen-parameter"),
  playback: document.querySelector("#playback-rate"),
  seed: document.querySelector("#simulation-seed"),
};

const buttons = {
  play: document.querySelector("[data-play]"),
  step: document.querySelector("[data-step]"),
  reset: document.querySelector("[data-reset]"),
  newSeed: document.querySelector("[data-new-seed]"),
  export: document.querySelector("[data-export]"),
  snapshot: document.querySelector("[data-snapshot]"),
  parametersOpen: document.querySelector("[data-parameters-open]"),
  parametersClose: [
    ...document.querySelectorAll("[data-parameters-close]"),
  ],
  scrollMethod: document.querySelector("[data-scroll-method]"),
};

const outputs = {
  runState: document.querySelector("[data-run-state]"),
  playLabel: document.querySelector("[data-play-label]"),
  playIcon: document.querySelector("[data-play-icon]"),
  time: document.querySelector("[data-time]"),
  displacement: document.querySelector("[data-displacement]"),
  collisions: document.querySelector("[data-collisions]"),
  thermalSpeed: document.querySelector("[data-thermal-speed]"),
  tracerReadout: document.querySelector("[data-tracer-readout]"),
  hoverDisplacement: document.querySelector("[data-hover-displacement]"),
  hoverSpeed: document.querySelector("[data-hover-speed]"),
  progress: document.querySelector("[data-progress]"),
  modelParticleCount: document.querySelector("[data-model-particle-count]"),
  modelLargeMass: document.querySelector("[data-model-large-mass]"),
  modelMassRatio: document.querySelector("[data-model-mass-ratio]"),
};

const presetButtons = [
  ...document.querySelectorAll("[data-preset]"),
];
const viewToggleButtons = [
  ...document.querySelectorAll("[data-view-toggle]"),
];
const persistentSidebarMedia = window.matchMedia("(min-width: 1180px)");

const displayOptions = {
  trail: true,
  impacts: true,
  streaks: true,
};

const TRACE_PALETTE = [
  [9, 126, 128],
  [0, 104, 123],
  [10, 76, 105],
  [13, 48, 70],
];

function traceColour(progress, alpha = 1) {
  const value = clamp(progress, 0, 1);
  const scaled = value * (TRACE_PALETTE.length - 1);
  const lowerIndex = Math.floor(scaled);
  const upperIndex = Math.min(TRACE_PALETTE.length - 1, lowerIndex + 1);
  const blend = scaled - lowerIndex;
  const channels = TRACE_PALETTE[lowerIndex].map((channel, index) =>
    Math.round(
      channel +
        (TRACE_PALETTE[upperIndex][index] - channel) * blend,
    ),
  );
  return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
}

const PRESETS = {
  reference: {
    particleCount: 1000,
    temperature: 373,
    massRatio: 10,
    restitution: 1,
    knudsen: 15,
    playback: 20,
    seed: 2026,
  },
  heavy: {
    particleCount: 1000,
    temperature: 373,
    massRatio: 50,
    restitution: 1,
    knudsen: 15,
    playback: 20,
    seed: 2026,
  },
  inelastic: {
    particleCount: 1000,
    temperature: 373,
    massRatio: 10,
    restitution: 0.5,
    knudsen: 15,
    playback: 20,
    seed: 2026,
  },
  "long-path": {
    particleCount: 1000,
    temperature: 373,
    massRatio: 10,
    restitution: 1,
    knudsen: 30,
    playback: 20,
    seed: 2026,
  },
};

const CONSTANTS = {
  boltzmann: 1.38e-23,
  smallMassKg: 28.96e-3 / 6.02e23,
  smallRadiusNm: 0.16,
  largeRadiusNm: 1.6,
  boxSizeNm: 11.2,
  maxTimePs: 200,
  integrationSafety: 0.2,
  maxStepFraction: 0.1,
  resetStepFraction: 0.01,
};

const pointer = {
  x: 0,
  y: 0,
  active: false,
};

const viewport = {
  width: 1,
  height: 1,
  pixelRatio: 1,
  stageWidth: 1,
  x: 0,
  y: 0,
  size: 1,
  scale: 1,
};

let state = null;
let running = false;
let simulationAccumulator = 0;
let previousFrameTime = performance.now();
let lastMetricUpdate = 0;

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function boundedNumber(input, fallback) {
  const minimum = Number(input.min);
  const maximum = Number(input.max);
  const parsed = Number(input.value);
  const value = Number.isFinite(parsed) ? parsed : fallback;
  const bounded = clamp(value, minimum, maximum);
  input.value = String(bounded);
  return bounded;
}

function readParameters() {
  const particleCount = Math.round(
    boundedNumber(controls.particleCount, 1000),
  );
  controls.particleCount.value = String(particleCount);

  const temperature = boundedNumber(controls.temperature, 373);
  const massRatio = boundedNumber(controls.massRatio, 10);
  const restitution = boundedNumber(controls.restitution, 1);
  const knudsen = boundedNumber(controls.knudsen, 15);
  const playback = boundedNumber(controls.playback, 20);
  const seed = Math.trunc(boundedNumber(controls.seed, 2026)) >>> 0;
  controls.seed.value = String(seed);

  const thermalSpeed =
    Math.sqrt(
      (3 * CONSTANTS.boltzmann * temperature) / CONSTANTS.smallMassKg,
    ) / 1000;
  const resetInterval =
    (knudsen * CONSTANTS.smallRadiusNm) / thermalSpeed;

  return {
    particleCount,
    temperature,
    massRatio,
    restitution,
    knudsen,
    playback,
    seed,
    thermalSpeed,
    resetInterval,
  };
}

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

function simulationTimeStep(parameters, tracerSpeed = 0) {
  const limitingSpeed = Math.max(parameters.thermalSpeed, tracerSpeed, 1e-9);
  const displacementLimit =
    (CONSTANTS.maxStepFraction * CONSTANTS.smallRadiusNm) / limitingSpeed;
  const resetLimit =
    CONSTANTS.resetStepFraction * parameters.resetInterval;
  return CONSTANTS.integrationSafety * Math.min(displacementLimit, resetLimit);
}

function initializeState() {
  const parameters = readParameters();
  const random = mulberry32(parameters.seed);
  const count = parameters.particleCount;
  const positions = new Float64Array(count * 2);
  const velocities = new Float64Array(count * 2);
  const resetTimes = new Float64Array(count);
  const centre = CONSTANTS.boxSizeNm / 2;
  const exclusionRadius =
    CONSTANTS.largeRadiusNm + CONSTANTS.smallRadiusNm + 0.015;

  for (let index = 0; index < count; index += 1) {
    const offset = index * 2;
    let x = centre;
    let y = centre;
    let attempts = 0;

    do {
      x =
        CONSTANTS.smallRadiusNm +
        random() *
          (CONSTANTS.boxSizeNm - 2 * CONSTANTS.smallRadiusNm);
      y =
        CONSTANTS.smallRadiusNm +
        random() *
          (CONSTANTS.boxSizeNm - 2 * CONSTANTS.smallRadiusNm);
      attempts += 1;
    } while (
      Math.hypot(x - centre, y - centre) <= exclusionRadius &&
      attempts < 1000
    );

    const angle = random() * Math.PI * 2;
    positions[offset] = x;
    positions[offset + 1] = y;
    velocities[offset] = parameters.thermalSpeed * Math.cos(angle);
    velocities[offset + 1] = parameters.thermalSpeed * Math.sin(angle);
    resetTimes[index] = random() * parameters.resetInterval;
  }

  state = {
    parameters,
    random,
    positions,
    velocities,
    resetTimes,
    tracerX: centre,
    tracerY: centre,
    tracerVelocityX: 0,
    tracerVelocityY: 0,
    startX: centre,
    startY: centre,
    time: 0,
    impulses: 0,
    contacts: 0,
    resets: 0,
    path: [{ x: centre, y: centre, time: 0 }],
    lastPathTime: 0,
    collisionPulses: [],
    resetPulses: [],
  };

  simulationAccumulator = 0;
  setRunning(false);
  updatePresetSelection();
  updateMetrics(true);
  drawScene();
}

function setRunning(nextRunning) {
  running = Boolean(nextRunning);
  observatory.classList.toggle("is-running", running);
  outputs.runState.textContent = running
    ? "Running"
    : state?.time > 0
      ? "Paused"
      : "Ready";
  outputs.playLabel.textContent = running ? "Pause" : "Run";
  outputs.playIcon.setAttribute(
    "d",
    running ? "M7 5h4v14H7zm6 0h4v14h-4z" : "M8 5l11 7-11 7z",
  );
  if (!running && state) {
    updateMetrics(true);
    drawScene();
  }
  window.dispatchEvent(
    new CustomEvent("task02:runstate", {
      detail: { running, time: state?.time ?? 0 },
    }),
  );
}

function reflectSmallParticle(index) {
  const offset = index * 2;
  const minimum = CONSTANTS.smallRadiusNm;
  const maximum = CONSTANTS.boxSizeNm - CONSTANTS.smallRadiusNm;
  let x = state.positions[offset];
  let y = state.positions[offset + 1];
  let vx = state.velocities[offset];
  let vy = state.velocities[offset + 1];

  if (x < minimum) {
    x = minimum + (minimum - x);
    vx = Math.abs(vx);
  } else if (x > maximum) {
    x = maximum - (x - maximum);
    vx = -Math.abs(vx);
  }

  if (y < minimum) {
    y = minimum + (minimum - y);
    vy = Math.abs(vy);
  } else if (y > maximum) {
    y = maximum - (y - maximum);
    vy = -Math.abs(vy);
  }

  state.positions[offset] = clamp(x, minimum, maximum);
  state.positions[offset + 1] = clamp(y, minimum, maximum);
  state.velocities[offset] = vx;
  state.velocities[offset + 1] = vy;
}

function reflectTracer() {
  const minimum = CONSTANTS.largeRadiusNm;
  const maximum = CONSTANTS.boxSizeNm - CONSTANTS.largeRadiusNm;

  if (state.tracerX < minimum) {
    state.tracerX = minimum + (minimum - state.tracerX);
    state.tracerVelocityX = Math.abs(state.tracerVelocityX);
  } else if (state.tracerX > maximum) {
    state.tracerX = maximum - (state.tracerX - maximum);
    state.tracerVelocityX = -Math.abs(state.tracerVelocityX);
  }

  if (state.tracerY < minimum) {
    state.tracerY = minimum + (minimum - state.tracerY);
    state.tracerVelocityY = Math.abs(state.tracerVelocityY);
  } else if (state.tracerY > maximum) {
    state.tracerY = maximum - (state.tracerY - maximum);
    state.tracerVelocityY = -Math.abs(state.tracerVelocityY);
  }

  state.tracerX = clamp(state.tracerX, minimum, maximum);
  state.tracerY = clamp(state.tracerY, minimum, maximum);
}

function resetExpiredDirections() {
  const parameters = state.parameters;

  for (let index = 0; index < parameters.particleCount; index += 1) {
    if (state.resetTimes[index] > state.time) continue;

    const offset = index * 2;
    const angle = state.random() * Math.PI * 2;
    state.velocities[offset] = parameters.thermalSpeed * Math.cos(angle);
    state.velocities[offset + 1] = parameters.thermalSpeed * Math.sin(angle);
    state.resetTimes[index] += parameters.resetInterval;
    state.resets += 1;

    if (
      state.resetPulses.length < 24 &&
      (index + state.resets) % 73 === 0
    ) {
      state.resetPulses.push({
        x: state.positions[offset],
        y: state.positions[offset + 1],
        age: 0,
      });
    }
  }
}

function resolveTracerContacts() {
  const parameters = state.parameters;
  const contactDistance =
    CONSTANTS.smallRadiusNm + CONSTANTS.largeRadiusNm;
  const contactDistanceSquared = contactDistance * contactDistance;
  const inverseSmallMass = 1;
  const inverseLargeMass = 1 / parameters.massRatio;
  const inverseMassSum = inverseSmallMass + inverseLargeMass;

  for (let pass = 0; pass < 2; pass += 1) {
    for (let index = 0; index < parameters.particleCount; index += 1) {
      const offset = index * 2;
      const deltaX = state.tracerX - state.positions[offset];
      const deltaY = state.tracerY - state.positions[offset + 1];
      const distanceSquared = deltaX * deltaX + deltaY * deltaY;
      if (distanceSquared > contactDistanceSquared) continue;

      state.contacts += 1;
      let distance = Math.sqrt(Math.max(distanceSquared, 1e-16));
      let normalX = deltaX / distance;
      let normalY = deltaY / distance;
      if (!Number.isFinite(normalX) || !Number.isFinite(normalY)) {
        const angle = state.random() * Math.PI * 2;
        normalX = Math.cos(angle);
        normalY = Math.sin(angle);
        distance = 0;
      }

      const overlap = contactDistance - distance + 1e-8;
      if (overlap > 0) {
        const smallCorrection =
          (overlap * inverseSmallMass) / inverseMassSum;
        const largeCorrection =
          (overlap * inverseLargeMass) / inverseMassSum;
        state.positions[offset] -= normalX * smallCorrection;
        state.positions[offset + 1] -= normalY * smallCorrection;
        state.tracerX += normalX * largeCorrection;
        state.tracerY += normalY * largeCorrection;
      }

      const relativeNormalVelocity =
        (state.tracerVelocityX - state.velocities[offset]) * normalX +
        (state.tracerVelocityY - state.velocities[offset + 1]) * normalY;

      if (relativeNormalVelocity < 0) {
        const impulse =
          (-(1 + parameters.restitution) * relativeNormalVelocity) /
          inverseMassSum;
        state.velocities[offset] -=
          impulse * inverseSmallMass * normalX;
        state.velocities[offset + 1] -=
          impulse * inverseSmallMass * normalY;
        state.tracerVelocityX +=
          impulse * inverseLargeMass * normalX;
        state.tracerVelocityY +=
          impulse * inverseLargeMass * normalY;
        state.impulses += 1;

        if (state.collisionPulses.length < 28) {
          state.collisionPulses.push({
            x:
              state.positions[offset] +
              normalX * CONSTANTS.smallRadiusNm,
            y:
              state.positions[offset + 1] +
              normalY * CONSTANTS.smallRadiusNm,
            age: 0,
          });
        }
      }

      reflectSmallParticle(index);
      reflectTracer();
    }
  }
}

function advanceSimulation(timeStep) {
  const parameters = state.parameters;
  const effectiveTimeStep = Math.min(
    timeStep,
    CONSTANTS.maxTimePs - state.time,
  );
  resetExpiredDirections();

  for (let index = 0; index < parameters.particleCount; index += 1) {
    const offset = index * 2;
    state.positions[offset] +=
      state.velocities[offset] * effectiveTimeStep;
    state.positions[offset + 1] +=
      state.velocities[offset + 1] * effectiveTimeStep;
    reflectSmallParticle(index);
  }

  state.tracerX += state.tracerVelocityX * effectiveTimeStep;
  state.tracerY += state.tracerVelocityY * effectiveTimeStep;
  reflectTracer();
  resolveTracerContacts();
  state.time += effectiveTimeStep;

  if (state.time - state.lastPathTime >= 0.08) {
    state.path.push({
      x: state.tracerX,
      y: state.tracerY,
      time: state.time,
    });
    state.lastPathTime = state.time;
    if (state.path.length > 2500) state.path.shift();
  }

  if (state.time >= CONSTANTS.maxTimePs) {
    state.time = CONSTANTS.maxTimePs;
    setRunning(false);
    outputs.runState.textContent = "Complete";
    updateMetrics(true);
  }
}

function resizeCanvas() {
  viewport.width = Math.max(320, canvas.clientWidth);
  viewport.height = Math.max(420, canvas.clientHeight);
  viewport.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(viewport.width * viewport.pixelRatio);
  canvas.height = Math.round(viewport.height * viewport.pixelRatio);
  context.setTransform(
    viewport.pixelRatio,
    0,
    0,
    viewport.pixelRatio,
    0,
    0,
  );

  const sidebarWidth = observatory.classList.contains(
    "has-persistent-sidebar",
  )
    ? parameterDrawer.getBoundingClientRect().width
    : 0;
  viewport.stageWidth = Math.max(320, viewport.width - sidebarWidth);
  viewport.size =
    Math.max(viewport.stageWidth, viewport.height) * 1.035;
  viewport.x = (viewport.stageWidth - viewport.size) / 2;
  viewport.y = (viewport.height - viewport.size) / 2;
  viewport.scale = viewport.size / CONSTANTS.boxSizeNm;
  drawScene();
}

function worldX(value) {
  return viewport.x + value * viewport.scale;
}

function worldY(value) {
  return viewport.y + viewport.size - value * viewport.scale;
}

function displayHash(index, salt = 0) {
  let value = (index + 1 + salt * 1013) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return ((value ^ (value >>> 15)) >>> 0) / 4294967296;
}

function drawBackground() {
  context.fillStyle = "#fbfaf6";
  context.fillRect(0, 0, viewport.width, viewport.height);
}

function drawGrid() {
  context.save();
  context.strokeStyle = "rgba(54, 52, 47, 0.075)";
  context.lineWidth = 0.7;

  for (let value = 0; value <= CONSTANTS.boxSizeNm; value += 1.4) {
    const x = worldX(value);
    const y = worldY(value);
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, viewport.height);
    context.moveTo(0, y);
    context.lineTo(viewport.width, y);
    context.stroke();
  }
  context.restore();
}

function drawTracerPath() {
  if (!displayOptions.trail || !state || state.path.length < 2) return;

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";

  context.strokeStyle = "rgba(6, 83, 101, 0.2)";
  context.lineWidth = 7.5;
  context.beginPath();
  context.moveTo(worldX(state.path[0].x), worldY(state.path[0].y));
  for (let index = 1; index < state.path.length; index += 1) {
    context.lineTo(
      worldX(state.path[index].x),
      worldY(state.path[index].y),
    );
  }
  context.stroke();

  for (let index = 1; index < state.path.length; index += 1) {
    const progress = index / (state.path.length - 1);
    const previous = state.path[index - 1];
    const current = state.path[index];
    context.strokeStyle = traceColour(progress, 0.58 + progress * 0.32);
    context.lineWidth = 1 + progress * 1.15;
    context.beginPath();
    context.moveTo(worldX(previous.x), worldY(previous.y));
    context.lineTo(worldX(current.x), worldY(current.y));
    context.stroke();
  }

  context.restore();
}

function drawParticleStreaks() {
  if (!displayOptions.streaks || !running) return;

  const count = state.parameters.particleCount;
  const speedScale = 5.5 / Math.max(state.parameters.thermalSpeed, 1e-9);
  context.save();
  context.lineWidth = 0.7;
  context.lineCap = "round";
  context.strokeStyle = "rgba(78, 75, 68, 0.12)";
  context.beginPath();

  for (let index = 0; index < count; index += 3) {
    const offset = index * 2;
    const x = worldX(state.positions[offset]);
    const y = worldY(state.positions[offset + 1]);
    const dx = state.velocities[offset] * speedScale;
    const dy = -state.velocities[offset + 1] * speedScale;
    context.moveTo(x, y);
    context.lineTo(x - dx, y - dy);
  }

  context.stroke();
  context.restore();
}

function drawSmallParticles() {
  const count = state.parameters.particleCount;
  const baseRadius = clamp(
    CONSTANTS.smallRadiusNm * viewport.scale * 0.24,
    2.2,
    3.8,
  );
  const palette = [
    "#78969a",
    "#8090a2",
    "#9a87a2",
    "#c2a35d",
    "#ba7563",
    "#829173",
  ];

  context.save();
  context.globalAlpha = 0.9;
  palette.forEach((colour, colourIndex) => {
    context.fillStyle = colour;
    context.strokeStyle = "rgba(56, 52, 46, 0.15)";
    context.lineWidth = 0.45;
    context.beginPath();
    for (let index = 0; index < count; index += 1) {
      const assignedColour = Math.floor(
        displayHash(index, 23) * palette.length,
      );
      if (assignedColour !== colourIndex) continue;
      const offset = index * 2;
      const x = worldX(state.positions[offset]);
      const y = worldY(state.positions[offset + 1]);
      const radius =
        baseRadius * (0.82 + displayHash(index, 7) * 0.32);
      context.moveTo(x + radius, y);
      context.arc(x, y, radius, 0, Math.PI * 2);
    }
    context.fill();
    context.stroke();
  });
  context.restore();
}

function drawCollisionPulses(frameDelta) {
  if (!state.collisionPulses.length) return;

  context.save();
  state.collisionPulses.forEach((pulse) => {
    pulse.age += frameDelta;
    const progress = pulse.age / 0.18;
    if (!displayOptions.impacts) return;
    const alpha = Math.max(0, 0.62 * (1 - progress));
    const radius = 2 + progress * 7;
    const x = worldX(pulse.x);
    const y = worldY(pulse.y);
    context.strokeStyle = traceColour(progress, alpha);
    context.lineWidth = 1.15;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.stroke();
    context.strokeStyle = `rgba(230, 184, 67, ${alpha * 0.46})`;
    context.lineWidth = 0.7;
    context.beginPath();
    context.arc(x, y, radius * 1.65, 0, Math.PI * 2);
    context.stroke();
  });
  context.restore();

  state.collisionPulses = state.collisionPulses.filter(
    (pulse) => pulse.age < 0.18,
  );
}

function drawResetPulses(frameDelta) {
  if (!state.resetPulses.length) return;

  context.save();
  state.resetPulses.forEach((pulse) => {
    pulse.age += frameDelta;
    const progress = pulse.age / 0.18;
    context.fillStyle = `rgba(82, 76, 68, ${Math.max(0, 0.13 * (1 - progress))})`;
    context.beginPath();
    context.arc(
      worldX(pulse.x),
      worldY(pulse.y),
      1.1 + progress * 2.6,
      0,
      Math.PI * 2,
    );
    context.fill();
  });
  context.restore();

  state.resetPulses = state.resetPulses.filter(
    (pulse) => pulse.age < 0.18,
  );
}

function drawTracer() {
  const x = worldX(state.tracerX);
  const y = worldY(state.tracerY);
  const radius = CONSTANTS.largeRadiusNm * viewport.scale;

  context.save();
  const pulse = running ? 0.5 + 0.5 * Math.sin(performance.now() / 520) : 0;
  const halo = context.createRadialGradient(
    x,
    y,
    radius * 0.88,
    x,
    y,
    radius * (1.16 + pulse * 0.025),
  );
  halo.addColorStop(0, "rgba(159, 76, 55, 0)");
  halo.addColorStop(0.72, "rgba(159, 76, 55, 0.035)");
  halo.addColorStop(1, `rgba(159, 76, 55, ${0.08 + pulse * 0.025})`);
  context.fillStyle = halo;
  context.beginPath();
  context.arc(x, y, radius * 1.18, 0, Math.PI * 2);
  context.fill();

  const tracerFill = context.createRadialGradient(
    x - radius * 0.28,
    y - radius * 0.3,
    radius * 0.08,
    x,
    y,
    radius,
  );
  tracerFill.addColorStop(0, "#c98970");
  tracerFill.addColorStop(0.62, "#ad624c");
  tracerFill.addColorStop(1, "#864837");
  context.fillStyle = tracerFill;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "rgba(76, 52, 43, 0.5)";
  context.lineWidth = Math.max(1.5, radius * 0.012);
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function drawStartMarker() {
  const x = worldX(state.startX);
  const y = worldY(state.startY);
  context.save();
  context.strokeStyle = "rgba(53, 51, 47, 0.55)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(x - 4, y);
  context.lineTo(x + 4, y);
  context.moveTo(x, y - 4);
  context.lineTo(x, y + 4);
  context.stroke();
  context.restore();
}

function drawScene(frameDelta = 0) {
  if (!state) return;
  drawBackground();
  drawGrid();

  context.save();
  context.beginPath();
  context.rect(
    viewport.x,
    viewport.y,
    viewport.size,
    viewport.size,
  );
  context.clip();
  drawParticleStreaks();
  drawSmallParticles();
  drawResetPulses(frameDelta);
  drawCollisionPulses(frameDelta);
  drawTracer();
  drawTracerPath();
  drawStartMarker();
  context.restore();
}

function updateMetrics(force = false) {
  const now = performance.now();
  if (!force && now - lastMetricUpdate < 90) return;
  lastMetricUpdate = now;

  const displacement = Math.hypot(
    state.tracerX - state.startX,
    state.tracerY - state.startY,
  );
  outputs.time.textContent = `${state.time.toFixed(2)} ps`;
  outputs.displacement.textContent = `${displacement.toFixed(3)} nm`;
  outputs.collisions.textContent = state.impulses.toLocaleString();
  outputs.thermalSpeed.textContent =
    `${state.parameters.thermalSpeed.toFixed(3)} nm ps⁻¹`;
  outputs.modelParticleCount.textContent =
    state.parameters.particleCount.toLocaleString();
  outputs.modelLargeMass.textContent =
    `${(CONSTANTS.smallMassKg * state.parameters.massRatio).toExponential(4)} kg`;
  outputs.modelMassRatio.textContent =
    state.parameters.massRatio.toLocaleString();
  const progress = clamp(state.time / CONSTANTS.maxTimePs, 0, 1);
  outputs.progress.style.setProperty("--simulation-progress", progress);
  outputs.progress.setAttribute("aria-valuenow", state.time.toFixed(2));
}

function advanceByOnePicosecond() {
  if (!state) return;
  if (state.time >= CONSTANTS.maxTimePs) initializeState();
  setRunning(false);

  const target = Math.min(state.time + 1, CONSTANTS.maxTimePs);
  while (state.time < target - 1e-10) {
    const tracerSpeed = Math.hypot(
      state.tracerVelocityX,
      state.tracerVelocityY,
    );
    const timeStep = Math.min(
      simulationTimeStep(state.parameters, tracerSpeed),
      target - state.time,
    );
    advanceSimulation(timeStep);
  }

  if (state.time < CONSTANTS.maxTimePs) {
    outputs.runState.textContent = "Stepped";
  }
  updateMetrics(true);
  drawScene();
  window.dispatchEvent(
    new CustomEvent("task02:step", {
      detail: { time: state.time },
    }),
  );
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportTrajectory() {
  if (!state) return;
  const rows = [
    ["time_ps", "tracer_x_nm", "tracer_y_nm", "displacement_nm"],
    ...state.path.map((point) => [
      point.time.toFixed(6),
      point.x.toFixed(9),
      point.y.toFixed(9),
      Math.hypot(
        point.x - state.startX,
        point.y - state.startY,
      ).toFixed(9),
    ]),
  ];
  const metadata = [
    `# seed=${state.parameters.seed}`,
    `# particle_count=${state.parameters.particleCount}`,
    `# temperature_K=${state.parameters.temperature}`,
    `# tracer_mass_ratio=${state.parameters.massRatio}`,
    `# restitution=${state.parameters.restitution}`,
    `# reset_factor=${state.parameters.knudsen}`,
  ];
  const csv = [
    ...metadata,
    ...rows.map((row) => row.join(",")),
  ].join("\n");
  downloadBlob(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
    `brownian-trajectory-seed-${state.parameters.seed}.csv`,
  );
  outputs.runState.textContent = "Exported";
}

function saveCanvasImage() {
  canvas.toBlob((blob) => {
    if (!blob) return;
    downloadBlob(
      blob,
      `brownian-motion-${state.parameters.seed}-${state.time.toFixed(0)}ps.png`,
    );
    outputs.runState.textContent = "Image saved";
  }, "image/png");
}

function toggleDisplayOption(button) {
  const option = button.dataset.viewToggle;
  if (!(option in displayOptions)) return;
  displayOptions[option] = !displayOptions[option];
  button.setAttribute("aria-pressed", String(displayOptions[option]));
  drawScene();
}

function animationFrame(now) {
  const frameDeltaSeconds = Math.min(
    Math.max((now - previousFrameTime) / 1000, 0),
    0.08,
  );
  previousFrameTime = now;
  const wasRunning = running;

  if (running && state) {
    state.parameters.playback = boundedNumber(controls.playback, 20);
    simulationAccumulator +=
      frameDeltaSeconds * state.parameters.playback;

    const tracerSpeed = Math.hypot(
      state.tracerVelocityX,
      state.tracerVelocityY,
    );
    const timeStep = simulationTimeStep(state.parameters, tracerSpeed);
    const availableSteps = Math.floor(simulationAccumulator / timeStep);
    const steps = Math.min(availableSteps, 420);

    for (let index = 0; index < steps; index += 1) {
      advanceSimulation(timeStep);
      if (!running) break;
    }

    simulationAccumulator -= steps * timeStep;
    simulationAccumulator = Math.min(
      simulationAccumulator,
      timeStep * 840,
    );
    updateMetrics();
  }

  if (wasRunning) {
    drawScene(frameDeltaSeconds);
  }
  if (pointer.active) updateTracerReadout();
  requestAnimationFrame(animationFrame);
}

function updatePresetSelection() {
  const current = {
    particleCount: Number(controls.particleCount.value),
    temperature: Number(controls.temperature.value),
    massRatio: Number(controls.massRatio.value),
    restitution: Number(controls.restitution.value),
    knudsen: Number(controls.knudsen.value),
    playback: Number(controls.playback.value),
    seed: Number(controls.seed.value),
  };

  presetButtons.forEach((button) => {
    const preset = PRESETS[button.dataset.preset];
    const matches = Object.entries(preset).every(
      ([name, value]) => Math.abs(current[name] - value) < 1e-9,
    );
    button.classList.toggle("is-active", matches);
  });
}

function applyPreset(name) {
  const preset = PRESETS[name];
  if (!preset) return;

  Object.entries(preset).forEach(([controlName, value]) => {
    controls[controlName].value = String(value);
  });
  initializeState();
}

function syncParameterPanelLayout() {
  const persistent = persistentSidebarMedia.matches;
  observatory.classList.toggle("has-persistent-sidebar", persistent);
  document.body.classList.remove("drawer-locked");

  if (persistent) {
    observatory.classList.remove("is-drawer-open");
    parameterDrawer.inert = false;
    parameterDrawer.setAttribute("aria-hidden", "false");
    buttons.parametersOpen.setAttribute("aria-expanded", "true");
  } else {
    parameterDrawer.inert = true;
    parameterDrawer.setAttribute("aria-hidden", "true");
    buttons.parametersOpen.setAttribute("aria-expanded", "false");
  }

  window.requestAnimationFrame(resizeCanvas);
}

function openParameterDrawer() {
  if (persistentSidebarMedia.matches) return;
  observatory.classList.add("is-drawer-open");
  document.body.classList.add("drawer-locked");
  parameterDrawer.inert = false;
  parameterDrawer.setAttribute("aria-hidden", "false");
  buttons.parametersOpen.setAttribute("aria-expanded", "true");
  const closeButton = parameterDrawer.querySelector("[data-parameters-close]");
  window.setTimeout(() => closeButton?.focus(), 220);
}

function closeParameterDrawer({ returnFocus = true } = {}) {
  if (persistentSidebarMedia.matches) return;
  observatory.classList.remove("is-drawer-open");
  document.body.classList.remove("drawer-locked");
  parameterDrawer.inert = true;
  parameterDrawer.setAttribute("aria-hidden", "true");
  buttons.parametersOpen.setAttribute("aria-expanded", "false");
  if (returnFocus) buttons.parametersOpen.focus();
}

function updateTracerReadout() {
  if (!state || !pointer.active || window.innerWidth <= 680) {
    outputs.tracerReadout.hidden = true;
    return;
  }

  const tracerScreenX = worldX(state.tracerX);
  const tracerScreenY = worldY(state.tracerY);
  const tracerRadius = CONSTANTS.largeRadiusNm * viewport.scale;
  const overTracer =
    Math.hypot(pointer.x - tracerScreenX, pointer.y - tracerScreenY) <=
    tracerRadius * 1.06;

  if (!overTracer) {
    outputs.tracerReadout.hidden = true;
    return;
  }

  const displacement = Math.hypot(
    state.tracerX - state.startX,
    state.tracerY - state.startY,
  );
  const speed = Math.hypot(
    state.tracerVelocityX,
    state.tracerVelocityY,
  );
  outputs.hoverDisplacement.textContent = `${displacement.toFixed(3)} nm`;
  outputs.hoverSpeed.textContent = `${speed.toFixed(3)} nm ps⁻¹`;
  outputs.tracerReadout.style.left =
    `${clamp(pointer.x + 18, 16, viewport.width - 170)}px`;
  outputs.tracerReadout.style.top =
    `${clamp(pointer.y + 18, 88, viewport.height - 92)}px`;
  outputs.tracerReadout.hidden = false;
}

buttons.play.addEventListener("click", () => {
  if (state.time >= CONSTANTS.maxTimePs) initializeState();
  setRunning(!running);
});

buttons.step.addEventListener("click", advanceByOnePicosecond);
buttons.reset.addEventListener("click", initializeState);
buttons.export.addEventListener("click", exportTrajectory);
buttons.snapshot.addEventListener("click", saveCanvasImage);

buttons.newSeed.addEventListener("click", () => {
  const seedArray = new Uint32Array(1);
  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(seedArray);
  } else {
    seedArray[0] = Math.floor(Math.random() * 4294967296);
  }
  controls.seed.value = String(seedArray[0]);
  initializeState();
});

[
  controls.particleCount,
  controls.temperature,
  controls.massRatio,
  controls.restitution,
  controls.knudsen,
  controls.seed,
].forEach((input) => {
  input.addEventListener("change", initializeState);
});

controls.playback.addEventListener("change", () => {
  state.parameters.playback = boundedNumber(controls.playback, 20);
  updatePresetSelection();
});

buttons.parametersOpen.addEventListener("click", openParameterDrawer);
buttons.parametersClose.forEach((button) => {
  button.addEventListener("click", () => closeParameterDrawer());
});

presetButtons.forEach((button) => {
  button.addEventListener("click", () => applyPreset(button.dataset.preset));
});

viewToggleButtons.forEach((button) => {
  button.addEventListener("click", () => toggleDisplayOption(button));
});

buttons.scrollMethod?.addEventListener("click", () => {
  document.querySelector("#method")?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
  });
});

document.addEventListener("keydown", (event) => {
  const textEntryTarget =
    event.target instanceof HTMLElement &&
    event.target.matches("input, textarea, select");
  const activatingControl =
    event.target instanceof HTMLElement &&
    event.target.matches("button, a");
  if (!textEntryTarget && !activatingControl && event.code === "Space") {
    event.preventDefault();
    buttons.play.click();
  }
  if (!textEntryTarget && event.key.toLowerCase() === "r") {
    buttons.reset.click();
  }
  if (!textEntryTarget && event.key === "ArrowRight") {
    event.preventDefault();
    buttons.step.click();
  }
  if (
    event.key === "Escape" &&
    observatory.classList.contains("is-drawer-open")
  ) {
    closeParameterDrawer();
  }
});

canvas.addEventListener(
  "pointermove",
  (event) => {
    const rectangle = canvas.getBoundingClientRect();
    pointer.x =
      (event.clientX - rectangle.left) *
      (canvas.clientWidth / rectangle.width);
    pointer.y =
      (event.clientY - rectangle.top) *
      (canvas.clientHeight / rectangle.height);
    pointer.active = true;
    updateTracerReadout();
  },
  { passive: true },
);

canvas.addEventListener("pointerleave", () => {
  pointer.active = false;
  outputs.tracerReadout.hidden = true;
});

if (typeof persistentSidebarMedia.addEventListener === "function") {
  persistentSidebarMedia.addEventListener(
    "change",
    syncParameterPanelLayout,
  );
} else {
  persistentSidebarMedia.addListener(syncParameterPanelLayout);
}

new ResizeObserver(resizeCanvas).observe(canvas);
syncParameterPanelLayout();
initializeState();
resizeCanvas();
requestAnimationFrame(animationFrame);
})();
