import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "data/task06");

const H = 6.62607015e-34;
const E = 1.602176634e-19;
const M = 9.1093837139e-31;
const R = 0.065;
const SPACINGS = Object.freeze({ d1: 0.123e-9, d2: 0.213e-9 });

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

function write(relativePath, content) {
  writeFileSync(join(root, relativePath), content);
}

function sha256File(relativePath) {
  return createHash("sha256").update(readFileSync(join(root, relativePath))).digest("hex");
}

function parseCsv(relativePath) {
  const lines = read(relativePath).trimEnd().split(/\r?\n/);
  const headers = lines.shift().split(",");
  const rows = lines.map((line) => {
    const values = line.split(",");
    if (values.length !== headers.length) {
      throw new Error(`${relativePath} contains a malformed row`);
    }
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });
  return { headers, rows };
}

function writeCsv(relativePath, headers, rows) {
  const lines = [headers.join(",")];
  for (const row of rows) lines.push(headers.map((header) => row[header]).join(","));
  write(relativePath, `${lines.join("\n")}\n`);
}

function wavelengthM(voltageV) {
  return H / Math.sqrt(2 * M * E * voltageV);
}

function geometry(wavelength, spacing) {
  const q = wavelength / (2 * spacing);
  const theta = Math.asin(q);
  const phi = 2 * theta;
  return { q, theta, phi, radiusM: R * Math.sin(phi) };
}

function number(value) {
  return String(value);
}

function updateRadius(row, prefix, radiusM) {
  row[`${prefix}_photo_radius_m`] = number(radiusM);
  row[`${prefix}_photo_radius_mm`] = number(radiusM * 1000);
}

function updateVoltageRadius(row, familyId, radiusM) {
  row[`${familyId}_n1_photo_radius_m`] = number(radiusM);
  row[`${familyId}_n1_photo_radius_mm`] = number(radiusM * 1000);
}

function updateVoltageSweep() {
  const relativePath = "data/task06/voltage_sweep.csv";
  const { headers, rows } = parseCsv(relativePath);
  for (const row of rows) {
    const voltageV = Number(row.voltage_v);
    const wavelength = wavelengthM(voltageV);
    for (const familyId of ["d1", "d2"]) {
      updateVoltageRadius(row, familyId, geometry(wavelength, SPACINGS[familyId]).radiusM);
    }
  }
  writeCsv(relativePath, headers, rows);
}

function updateDiffractionOrders() {
  const relativePath = "data/task06/diffraction_orders.csv";
  const { headers, rows } = parseCsv(relativePath);
  for (const row of rows) {
    const q = Number(row.bragg_ratio_q);
    const theta = Math.asin(q);
    const phi = 2 * theta;
    const radiusM = R * Math.sin(phi);
    row.photo_radius_m = number(radiusM);
    row.photo_radius_mm = number(radiusM * 1000);
  }
  writeCsv(relativePath, headers, rows);
}

function updateReferenceAnchors() {
  const relativePath = "data/task06/reference_anchors.json";
  const anchors = JSON.parse(read(relativePath));
  for (const anchor of anchors.voltage_anchors) {
    for (const spacing of anchor.spacings) {
      spacing.first_order_photo_radius_m = geometry(
        anchor.wavelength_m,
        spacing.spacing_m,
      ).radiusM;
    }
  }
  write(relativePath, `${JSON.stringify(anchors, null, 2)}\n`);
}

function updateRelativisticExtension() {
  const relativePath = "data/task06/relativistic_extension.json";
  const evidence = JSON.parse(read(relativePath));
  evidence.formulae.photographic_radius = "x = r sin(phi)";
  for (const record of evidence.records) {
    for (const familyId of ["d1", "d2"]) {
      const spacing = SPACINGS[familyId];
      const nonrelRadius = geometry(record.wavelength_nonrel_pm * 1e-12, spacing).radiusM;
      const relRadius = geometry(record.wavelength_rel_pm * 1e-12, spacing).radiusM;
      record[familyId].radius_nonrel_mm = nonrelRadius * 1000;
      record[familyId].radius_rel_mm = relRadius * 1000;
      record[familyId].radius_shift_um = (relRadius - nonrelRadius) * 1e6;
    }
  }
  const d1Check = evidence.validation.checks.find((check) => check.name === "d1_exact_geometry");
  const d2Check = evidence.validation.checks.find((check) => check.name === "d2_exact_geometry");
  if (d1Check) d1Check.detail = "The d1 radius series uses the exact x=r sin(phi) projection.";
  if (d2Check) d2Check.detail = "The d2 radius series uses the exact x=r sin(phi) projection.";
  write(relativePath, `${JSON.stringify(evidence, null, 2)}\n`);
}

function updateReportAndManifest() {
  const reportPath = "data/task06/validation_report.json";
  const manifestPath = "data/task06/manifest.json";
  const report = JSON.parse(read(reportPath));
  const geometryCheck = report.checks.find((check) => check.name === "photographic_geometry");
  if (geometryCheck) {
    geometryCheck.explanation = "Every photographic radius uses x = r sin(phi).";
  }
  const caliperCheck = report.checks.find((check) => check.name === "caliper_geometry");
  if (caliperCheck) {
    caliperCheck.explanation = "Every caliper diameter uses y = 2r sin(phi) = 2x.";
  }

  const digestInputs = [
    "data/task06/voltage_sweep.csv",
    "data/task06/diffraction_orders.csv",
    "data/task06/validation_fits.csv",
    "data/task06/reference_anchors.json",
    "data/task06/relativistic_extension.json",
  ];
  const digest = createHash("sha256");
  for (const relativePath of digestInputs) {
    digest.update(`${relativePath}\0`);
    digest.update(read(relativePath));
    digest.update("\0");
  }
  const studyDigest = digest.digest("hex");
  report.study_digest = studyDigest;
  write(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  const manifest = JSON.parse(read(manifestPath));
  if (!manifest.expected_data_filenames.includes("relativistic_extension.json")) {
    manifest.expected_data_filenames.push("relativistic_extension.json");
  }
  manifest.geometry.photographic_radius = "x = r sin(phi)";
  manifest.geometry_note =
    "phi = 2 theta is the total electron scattering angle; theta is the Bragg glancing angle. The photographic screen radius is x = r sin(phi), while y = 2r sin(phi) is the full caliper chord.";
  manifest.study_digest = studyDigest;

  const hashedPaths = [
    ...manifest.expected_data_filenames
      .filter((name) => name !== "manifest.json")
      .map((name) => `data/task06/${name}`),
    ...manifest.expected_figure_filenames.map((name) => `figures/task06/${name}`),
  ];
  manifest.sha256 = Object.fromEntries(
    hashedPaths.map((relativePath) => [
      relativePath,
      sha256File(relativePath),
    ]),
  );
  write(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

updateVoltageSweep();
updateDiffractionOrders();
updateReferenceAnchors();
updateRelativisticExtension();
updateReportAndManifest();
console.log("Regenerated Task 6 screen-radius evidence with x = r sin(phi).");
