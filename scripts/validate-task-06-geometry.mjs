import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const H = 6.62607015e-34;
const E = 1.602176634e-19;
const M = 9.1093837139e-31;
const R = 0.065;
const SPACINGS = [0.123e-9, 0.213e-9];

function wavelength(voltage) {
  return H / Math.sqrt(2 * M * E * voltage);
}

function expectedRadius(voltage, spacing) {
  const lambda = wavelength(voltage);
  const theta = Math.asin(lambda / (2 * spacing));
  const phi = 2 * theta;
  return R * Math.sin(phi);
}

const expected = new Map([
  ["1000:d1", 0.020238773853033198],
  ["1000:d2", 0.011786037447139755],
  ["3000:d1", 0.01178371963558512],
  ["3000:d2", 0.0068236023140144314],
  ["5000:d1", 0.009142868051168885],
  ["5000:d2", 0.005288467433998002],
]);

for (const voltage of [1000, 3000, 5000]) {
  SPACINGS.forEach((spacing, index) => {
    const key = `${voltage}:d${index + 1}`;
    const radius = expectedRadius(voltage, spacing);
    assert(
      Math.abs(radius - expected.get(key)) < 5e-15,
      `${key} radius mismatch: ${radius}`,
    );
  });
}

const html = read("tasks/task-06.html");
const diffraction = read("assets/task-06-diffraction.js");
const evidence = read("assets/task-06-evidence.js");
const relativity = read("assets/task-06-relativity.js");
const manifest = JSON.parse(read("data/task06/manifest.json"));
const anchors = JSON.parse(read("data/task06/reference_anchors.json"));

assert(!html.includes("x=r\\sin(2\\phi)"), "HTML still contains x = r sin(2 phi)");
assert(!html.includes("x = r sin(2φ)"), "HTML still displays x = r sin(2 phi)");
assert(!diffraction.includes("65 * Math.sin(2 * phi)"), "Renderer still uses r sin(2 phi)");
assert(!evidence.includes("tubeRadiusM * Math.sin(2 * phi)"), "Evidence validator still uses r sin(2 phi)");
assert(!relativity.includes("CONSTANTS.r * Math.sin(2 * phi)"), "Relativity extension still uses r sin(2 phi)");
assert(manifest.geometry.photographic_radius === "x = r sin(phi)", "Manifest geometry is not x = r sin(phi)");
assert(manifest.geometry.caliper_diameter === "y = 2 r sin(phi) = 2x", "Manifest diameter geometry is inconsistent");

for (const anchor of anchors.voltage_anchors) {
  for (const spacing of anchor.spacings) {
    const spacingM = spacing.spacing_id === "d1" ? SPACINGS[0] : SPACINGS[1];
    const expectedX = expectedRadius(anchor.voltage_v, spacingM);
    assert(
      Math.abs(spacing.first_order_photo_radius_m - expectedX) < 5e-15,
      `Anchor ${anchor.voltage_v} ${spacing.spacing_id} has stale radius`,
    );
  }
}

console.log("Task 6 geometry regression checks passed.");