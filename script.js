const canvas = document.querySelector("#quantum-map");
const context = canvas.getContext("2d", { alpha: false });
const startButton = document.querySelector("[data-start]");
const taskReadout = document.querySelector(".task-readout");
const taskNumber = document.querySelector("[data-task-number]");
const taskName = document.querySelector("[data-task-name]");
const taskPosition = document.querySelector("[data-task-position]");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const tasks = [
  "Random Walk",
  "Brownian Motion",
  "Thermal Radiation",
  "Photoelectric Effect",
  "Hydrogen Spectrum",
  "Electron Diffraction",
  "Particle in a Box",
  "Quantum Cryptography",
  "Compton Scattering",
  "Hydrogenic Orbitals",
];

const state = {
  width: 0,
  height: 0,
  pixelRatio: 1,
  pointerX: 0.7,
  pointerY: 0.45,
  targetX: 0.7,
  targetY: 0.45,
  activeTask: 0,
  playing: false,
  visible: true,
  startTime: performance.now(),
};

function resizeCanvas() {
  state.width = window.innerWidth;
  state.height = window.innerHeight;
  state.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
  canvas.width = Math.round(state.width * state.pixelRatio);
  canvas.height = Math.round(state.height * state.pixelRatio);
  canvas.style.width = `${state.width}px`;
  canvas.style.height = `${state.height}px`;
  context.setTransform(state.pixelRatio, 0, 0, state.pixelRatio, 0, 0);
}

function drawGrid() {
  const spacing = Math.max(58, Math.min(92, state.width / 18));
  context.save();
  context.strokeStyle = "rgba(243, 240, 230, 0.035)";
  context.lineWidth = 1;

  for (let x = spacing; x < state.width; x += spacing) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, state.height);
    context.stroke();
  }

  for (let y = spacing; y < state.height; y += spacing) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(state.width, y);
    context.stroke();
  }
  context.restore();
}

function drawWave(time, index, centreY, amplitude, frequency, opacity) {
  const startX = state.width * 0.42;
  const endX = state.width * 1.04;
  const width = endX - startX;

  context.beginPath();
  for (let point = 0; point <= 160; point += 1) {
    const progress = point / 160;
    const x = startX + progress * width;
    const envelope = Math.sin(progress * Math.PI);
    const pointerPull = (state.pointerY - 0.5) * 55 * envelope;
    const y =
      centreY +
      Math.sin(progress * frequency + time * (0.36 + index * 0.07) + index * 1.4) *
        amplitude *
        envelope +
      pointerPull;

    if (point === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }

  context.strokeStyle = `rgba(89, 216, 232, ${opacity})`;
  context.lineWidth = index === 0 ? 1.8 : 1;
  context.stroke();
}

function drawOrbit(time) {
  const centreX = state.width * (state.width < 900 ? 0.76 : 0.77);
  const centreY = state.height * 0.42;
  const radiusX = Math.min(state.width * 0.2, 330);
  const radiusY = Math.min(state.height * 0.3, 250);

  context.save();
  context.translate(centreX, centreY);
  context.rotate(-0.2);
  context.strokeStyle = "rgba(243, 240, 230, 0.13)";
  context.lineWidth = 1;

  [1, 0.72, 0.44].forEach((scale, index) => {
    context.beginPath();
    context.ellipse(0, 0, radiusX * scale, radiusY * scale, index * 0.76, 0, Math.PI * 2);
    context.stroke();
  });

  for (let index = 0; index < 10; index += 1) {
    const angle = (index / 10) * Math.PI * 2 + time * 0.025;
    const x = Math.cos(angle) * radiusX;
    const y = Math.sin(angle) * radiusY;
    const isActive = index === state.activeTask;

    context.beginPath();
    context.arc(x, y, isActive ? 5 : 2.2, 0, Math.PI * 2);
    context.fillStyle = isActive ? "#59d8e8" : "rgba(243, 240, 230, 0.5)";
    context.fill();

    if (isActive) {
      context.beginPath();
      context.arc(x, y, 12, 0, Math.PI * 2);
      context.strokeStyle = "rgba(89, 216, 232, 0.38)";
      context.stroke();
    }
  }

  context.beginPath();
  context.arc(0, 0, 4, 0, Math.PI * 2);
  context.fillStyle = "#f3f0e6";
  context.fill();

  context.beginPath();
  context.arc(0, 0, 18 + Math.sin(time * 0.8) * 2, 0, Math.PI * 2);
  context.strokeStyle = "rgba(89, 216, 232, 0.3)";
  context.stroke();
  context.restore();
}

function drawPointerResponse() {
  const x = state.pointerX * state.width;
  const y = state.pointerY * state.height;
  context.save();
  context.strokeStyle = "rgba(89, 216, 232, 0.12)";
  context.lineWidth = 1;
  context.beginPath();
  context.arc(x, y, 34, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function render(now) {
  if (!state.visible) return;

  const time = reduceMotion.matches ? 0 : (now - state.startTime) / 1000;
  state.pointerX += (state.targetX - state.pointerX) * 0.035;
  state.pointerY += (state.targetY - state.pointerY) * 0.035;

  context.fillStyle = "#071018";
  context.fillRect(0, 0, state.width, state.height);
  drawGrid();
  drawWave(time, 0, state.height * 0.32, 76, 19, 0.34);
  drawWave(time, 1, state.height * 0.46, 112, 15, 0.2);
  drawWave(time, 2, state.height * 0.58, 62, 23, 0.14);
  drawOrbit(time);
  drawPointerResponse();

  if (!reduceMotion.matches) requestAnimationFrame(render);
}

function showTask(index) {
  state.activeTask = index % tasks.length;
  const displayNumber = String(state.activeTask + 1).padStart(2, "0");
  taskNumber.textContent = displayNumber;
  taskPosition.textContent = displayNumber;
  taskName.textContent = tasks[state.activeTask];
}

let taskTimer;
function startJourney() {
  if (state.playing) return;
  state.playing = true;
  startButton.querySelector("span").textContent = "Journey in motion";
  startButton.setAttribute("aria-pressed", "true");
  taskReadout.classList.add("is-playing");
  showTask(0);
  taskTimer = window.setInterval(() => showTask(state.activeTask + 1), 2800);
}

window.addEventListener("pointermove", (event) => {
  state.targetX = event.clientX / state.width;
  state.targetY = event.clientY / state.height;
});

window.addEventListener("resize", resizeCanvas);

document.addEventListener("visibilitychange", () => {
  state.visible = !document.hidden;
  if (state.visible && !reduceMotion.matches) requestAnimationFrame(render);
});

startButton.addEventListener("click", startJourney);

reduceMotion.addEventListener("change", () => {
  resizeCanvas();
  requestAnimationFrame(render);
});

resizeCanvas();
requestAnimationFrame(render);
requestAnimationFrame(() => document.body.classList.add("is-ready"));

window.addEventListener("beforeunload", () => window.clearInterval(taskTimer));
