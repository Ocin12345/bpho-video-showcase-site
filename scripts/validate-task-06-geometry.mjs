import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const H = 6.62607015e-34;
const E = 1.602176634e-19;
const M = 9.1093837139e-31;
const R = 0.065;
const SPACINGS = Object.freeze({ d1: 0.123e-9, d2: 0.213e-9 });

function parseCsv(relativePath) {
  const lines = read(relativePath).trim().split(/\r?\n/);
  const headers = lines.shift().split(",");
  return lines.map((line) => {
    const values = line.split(",");
    assert(values.length === headers.length, `${relativePath} contains a malformed row`);
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });
}

function wavelength(voltageV) {
  return H / Math.sqrt(2 * M * E * voltageV);
}

function expectedGeometry(voltageV, spacingM, order = 1) {
  const lambda = wavelength(voltageV);
  const q = (order * lambda) / (2 * spacingM);
  const theta = Math.asin(q);
  const phi = 2 * theta;
  return { lambda, q, theta, phi, radiusM: R * Math.sin(phi) };
}

function close(actual, expected, tolerance, label) {
  assert(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}, received ${actual}`,
  );
}

const stalePatterns = [
  /Math\.sin\(2\s*\*\s*phi\)/,
  /sin\(2\s*phi\)/,
  /sin\(2φ\)/,
  /x=r\\sin\(2\\phi\)/,
];
const productionFiles = [
  "assets/task-06-diffraction.js",
  "assets/task-06-evidence.js",
  "assets/task-06-relativity.js",
  "tasks/task-06.html",
  "data/task06/diffraction_orders.csv",
  "data/task06/manifest.json",
  "data/task06/reference_anchors.json",
  "data/task06/relativistic_extension.json",
  "data/task06/validation_fits.csv",
  "data/task06/validation_report.json",
  "data/task06/voltage_sweep.csv",
  "figures/task06/electron_diffraction_rings.svg",
  "figures/task06/ring_radius_vs_voltage.svg",
  "figures/task06/task06_summary.svg",
  "video/code-shots/code-shot-data.js",
];
for (const relativePath of productionFiles) {
  const content = read(relativePath);
  assert(
    stalePatterns.every((pattern) => !pattern.test(content)),
    `${relativePath} still contains the old x = r sin(2 phi) projection`,
  );
}

const manifest = JSON.parse(read("data/task06/manifest.json"));
assert(manifest.configuration.tube_radius_m === R, "Task 6 tube radius changed");
assert(manifest.geometry.photographic_radius === "x = r sin(phi)", "Manifest has stale photographic geometry");
assert(Math.abs(manifest.configuration.spacings[0].spacing_m - SPACINGS.d1) < 1e-25, "d1 spacing changed");
assert(Math.abs(manifest.configuration.spacings[1].spacing_m - SPACINGS.d2) < 1e-25, "d2 spacing changed");

const voltageRows = parseCsv("data/task06/voltage_sweep.csv");
assert(voltageRows.length === 401, "Voltage sweep must contain 401 rows");
for (const [voltageV, familyId] of [
  [1000, "d1"],
  [1000, "d2"],
  [3000, "d1"],
  [3000, "d2"],
  [5000, "d1"],
  [5000, "d2"],
]) {
  const row = voltageRows.find((candidate) => Number(candidate.voltage_v) === voltageV);
  const expected = expectedGeometry(voltageV, SPACINGS[familyId]);
  close(
    Number(row[`${familyId}_n1_photo_radius_m`]),
    expected.radiusM,
    5e-15,
    `${voltageV} V ${familyId} screen radius`,
  );
}
for (let index = 1; index < voltageRows.length; index += 1) {
  for (const familyId of ["d1", "d2"]) {
    assert(
      Number(voltageRows[index][`${familyId}_n1_photo_radius_m`]) <
        Number(voltageRows[index - 1][`${familyId}_n1_photo_radius_m`]),
      `${familyId} first-order radius is not strictly contracting at row ${index + 1}`,
    );
  }
}

const orderRows = parseCsv("data/task06/diffraction_orders.csv");
assert(orderRows.length === manifest.catalogue_size, "Diffraction-order catalogue size changed");
for (const row of orderRows) {
  const expected = expectedGeometry(Number(row.voltage_v), SPACINGS[row.spacing_id], Number(row.order_n));
  close(Number(row.photo_radius_m), expected.radiusM, 5e-15, `order ${row.voltage_v}:${row.spacing_id}:${row.order_n}`);
}

const anchors = JSON.parse(read("data/task06/reference_anchors.json"));
for (const anchor of anchors.voltage_anchors) {
  for (const spacing of anchor.spacings) {
    const expected = expectedGeometry(anchor.voltage_v, spacing.spacing_m);
    close(
      spacing.first_order_photo_radius_m,
      expected.radiusM,
      5e-15,
      `anchor ${anchor.voltage_v}:${spacing.spacing_id}`,
    );
  }
}

const fits = parseCsv("data/task06/validation_fits.csv");
for (const [familyId, expectedSpacingNm] of [["d1", 0.123], ["d2", 0.213]]) {
  const fit = fits.find((row) => row.spacing_id === familyId && row.fit_kind === "first_order");
  close(Number(fit.recovered_spacing_nm), expectedSpacingNm, 1e-12, `${familyId} Task 6a recovered spacing`);
  close(Number(fit.r_squared), 1, 1e-12, `${familyId} Task 6a R²`);
}

const report = JSON.parse(read("data/task06/validation_report.json"));
assert(report.passed === true && report.checks.length === 39, "Task 6 committed validation report is not locked");
assert(
  report.checks.find((check) => check.name === "photographic_geometry")?.explanation ===
    "Every photographic radius uses x = r sin(phi).",
  "Validation report has stale photographic geometry wording",
);

const relativistic = JSON.parse(read("data/task06/relativistic_extension.json"));
assert(relativistic.formulae.photographic_radius === "x = r sin(phi)", "Relativistic evidence has stale geometry wording");
for (const voltageV of [1000, 3000, 5000]) {
  const row = relativistic.records.find((candidate) => candidate.voltage_v === voltageV);
  for (const familyId of ["d1", "d2"]) {
    const expectedNonrel = expectedGeometry(voltageV, SPACINGS[familyId]).radiusM;
    close(Number(row[familyId].radius_nonrel_mm) * 1e-3, expectedNonrel, 5e-15, `${voltageV} V ${familyId} non-relativistic radius`);
    assert(row[familyId].radius_shift_um < 0, `${voltageV} V ${familyId} relativistic shift is not inward`);
  }
}

const codeShot = read("video/code-shots/code-shot-data.js");
assert(codeShot.includes("photoRadiusM: tubeRadiusM * Math.sin(phi)"), "Task 6 code shot is stale");

console.log(
  "Task 6 geometry validation passed: 6 independent anchors, 401 monotonic voltages, " +
    `${orderRows.length} diffraction orders, Task 6a d1/d2 recovery, relativity, and code-shot source.`,
);
