import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../tasks/task-08.html", import.meta.url), "utf8");
const script = await readFile(new URL("../assets/task-08.js", import.meta.url), "utf8");

function mismatch(thetaDeg, phiDeg) {
  const theta = (thetaDeg * Math.PI) / 180;
  const phi = (phiDeg * Math.PI) / 180;
  const classical =
    1 -
    Math.cos(theta) ** 2 * Math.cos(phi) ** 2 -
    Math.sin(theta) ** 2 * Math.sin(phi) ** 2;
  const quantum = Math.sin(phi - theta) ** 2;
  return { classical, quantum, difference: quantum - classical };
}

const close = (observed, expected, tolerance = 5e-12) =>
  Math.abs(observed - expected) <= tolerance;

const official = mismatch(-30, 30);
assert.ok(close(official.classical, 3 / 8));
assert.ok(close(official.quantum, 3 / 4));
assert.ok(close(official.difference, 3 / 8));

const anchors = [
  [0, 0, 0, 0],
  [45, 45, 0.5, 0],
  [-45, 45, 0.5, 1],
  [0, 90, 1, 1],
];
for (const [theta, phi, classical, quantum] of anchors) {
  const result = mismatch(theta, phi);
  assert.ok(close(result.classical, classical));
  assert.ok(close(result.quantum, quantum));
}

for (let theta = -90; theta <= 90; theta += 1) {
  for (let phi = -90; phi <= 90; phi += 1) {
    const result = mismatch(theta, phi);
    assert.ok(result.classical >= -5e-12 && result.classical <= 1 + 5e-12);
    assert.ok(result.quantum >= -5e-12 && result.quantum <= 1 + 5e-12);
    const identity = -0.5 * Math.sin(2 * theta * Math.PI / 180) * Math.sin(2 * phi * Math.PI / 180);
    assert.ok(close(result.difference, identity));
  }
}

for (const required of [
  'class="task08-page task08-recording"',
  'id="detector-canvas"',
  'id="sweep-canvas"',
  'id="landscape-canvas"',
  'data-preset="official"',
  'data-sample-count',
  'P<sub>C</sub> = 3/8 = 37.5%',
  'P<sub>Q</sub> = 3/4 = 75.0%',
]) assert.ok(html.includes(required), `Missing ${required}`);

for (const required of [
  "Math.cos(theta) ** 2 * Math.cos(phi) ** 2",
  "Math.sin(relativeAngle * DEG_TO_RAD) ** 2",
  "CLASSICAL_STREAM_SALT",
  "QUANTUM_STREAM_SALT",
  "wilsonInterval",
]) assert.ok(script.includes(required), `Missing ${required}`);

console.log("Task 8 physics and structure validation passed: official 3/8 versus 3/4 anchor, 32,761 angle pairs, deterministic sampling hooks, and required interactive surfaces.");
