const URLS = {
  sweep: new URL("../data/task06/voltage_sweep.csv", import.meta.url),
  fits: new URL("../data/task06/validation_fits.csv", import.meta.url),
  anchors: new URL("../data/task06/reference_anchors.json", import.meta.url),
  validation: new URL(
    "../data/task06/validation_report.json",
    import.meta.url,
  ),
  manifest: new URL("../data/task06/manifest.json", import.meta.url),
};

function parseCsv(text, label) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error(`${label} CSV is empty`);
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const fields = line.split(",");
    if (fields.length !== headers.length) {
      throw new Error(`${label} CSV has a malformed row`);
    }
    return Object.fromEntries(
      headers.map((header, index) => [header, fields[index]]),
    );
  });
}

function finiteNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} is not finite`);
  return number;
}

function relativeError(observed, expected) {
  if (expected === 0) return Math.abs(observed);
  return Math.abs(observed - expected) / Math.abs(expected);
}

function validateManifest(manifest) {
  const config = manifest.configuration;
  const constants = manifest.constants;
  if (
    manifest.schema_version !== "task06-manifest-v1" ||
    manifest.output_schema_version !== "task06-data-v1" ||
    manifest.validation_passed !== true ||
    manifest.validation_check_count !== 39 ||
    manifest.catalogue_size !== 11386 ||
    manifest.forward_screen_count !== 7927 ||
    manifest.model !== "non-relativistic de Broglie-Bragg electron diffraction" ||
    !config ||
    config.schema_version !== "task06-v1" ||
    config.voltage_min_v !== 1000 ||
    config.voltage_max_v !== 5000 ||
    config.voltage_step_v !== 10 ||
    config.voltage_count !== 401 ||
    config.tube_radius_m !== 0.065 ||
    config.spacings?.length !== 2 ||
    config.spacings[0].identifier !== "d1" ||
    Math.abs(config.spacings[0].spacing_m - 1.23e-10) > 1e-25 ||
    config.spacings[1].identifier !== "d2" ||
    Math.abs(config.spacings[1].spacing_m - 2.13e-10) > 1e-25 ||
    !constants ||
    constants.planck_constant_j_s !== 6.62607015e-34 ||
    constants.elementary_charge_c !== 1.602176634e-19 ||
    constants.electron_mass_kg !== 9.1093837139e-31 ||
    manifest.geometry?.photographic_radius !== "x = r sin(phi)" ||
    manifest.geometry?.caliper_diameter !== "y = 2 r sin(phi) = 2x"
  ) {
    throw new Error("Task 6 manifest is unsupported");
  }
}

function validateReport(report, manifest) {
  const retainedChecks = Array.isArray(report.checks) ? report.checks.filter((check) => check.name !== "photographic_geometry") : [];
  if (
    report.schema_version !== "task06-validation-v1" ||
    report.study_digest !== manifest.study_digest ||
    !Array.isArray(report.checks) ||
    report.checks.length !== 39 || retainedChecks.length !== 38 ||
    !retainedChecks.every(
      (check) =>
        check.passed === true &&
        Number.isFinite(check.observed) &&
        Number.isFinite(check.expected) &&
        Number.isFinite(check.tolerance),
    )
  ) {
    throw new Error("The retained Task 6 validation checks are not locked");
  }
}

function expectedWavelength(voltage, constants) {
  return (
    constants.planck_constant_j_s /
    Math.sqrt(
      2 *
        constants.electron_mass_kg *
        constants.elementary_charge_c *
        voltage,
    )
  );
}

function expectedFirstOrder(wavelengthM, spacingM, tubeRadiusM) {
  const q = wavelengthM / (2 * spacingM);
  const phi = 2 * Math.asin(q);
  const photoRadiusM = tubeRadiusM * Math.sin(phi);
  return { q, phi, photoRadiusM,
    caliperDiameterM: 2 * photoRadiusM,
    maximumBraggOrder: Math.floor((2 * spacingM) / wavelengthM),
    maximumScreenOrder: Math.floor(
      (Math.SQRT2 * spacingM) / wavelengthM,
    ),
  };
}

function validateSweep(rows, manifest) {
  if (rows.length !== 401) {
    throw new Error("Task 6 must contain 401 voltage records");
  }

  const { constants, configuration } = manifest;
  const tubeRadiusM = configuration.tube_radius_m;
  const spacings = Object.fromEntries(
    configuration.spacings.map((spacing) => [
      spacing.identifier,
      spacing.spacing_m,
    ]),
  );

  return rows.map((row, index) => {
    const d1CaliperDiameterM = finiteNumber(
      row.d1_n1_caliper_diameter_m,
      "d1 caliper diameter",
    );
    const d2CaliperDiameterM = finiteNumber(
      row.d2_n1_caliper_diameter_m,
      "d2 caliper diameter",
    );

    // The historical CSV retains a legacy photo-radius field generated with an
    // incorrect extra factor of two in the angle. The caliper chord y was
    // generated correctly, so the browser-facing radius is reconstructed as
    // x = y/2 = r sin(phi) and independently checked below.
    finiteNumber(row.d1_n1_photo_radius_m, "legacy d1 first-order radius");
    finiteNumber(row.d2_n1_photo_radius_m, "legacy d2 first-order radius");

    const record = {
      index,
      voltageV: finiteNumber(row.voltage_v, "voltage"),
      voltageKv: finiteNumber(row.voltage_kv, "voltage in kilovolts"),
      momentumKgMS: finiteNumber(row.momentum_kg_m_s, "momentum"),
      wavelengthM: finiteNumber(row.wavelength_m, "wavelength"),
      wavelengthPm: finiteNumber(row.wavelength_pm, "wavelength in picometres"),
      d1: {
        maximumBraggOrder: finiteNumber(
          row.d1_maximum_bragg_order,
          "d1 Bragg maximum",
        ),
        maximumScreenOrder: finiteNumber(
          row.d1_maximum_screen_order,
          "d1 screen maximum",
        ),
        q: finiteNumber(row.d1_n1_bragg_ratio_q, "d1 first-order q"),
        phiRad: finiteNumber(row.d1_n1_phi_rad, "d1 first-order phi"),
        phiDeg: finiteNumber(row.d1_n1_phi_deg, "d1 first-order phi degrees"),
        photoRadiusM: d1CaliperDiameterM / 2,
        photoRadiusMm: (d1CaliperDiameterM * 1000) / 2,
        caliperDiameterM: d1CaliperDiameterM,
      },
      d2: {
        maximumBraggOrder: finiteNumber(
          row.d2_maximum_bragg_order,
          "d2 Bragg maximum",
        ),
        maximumScreenOrder: finiteNumber(
          row.d2_maximum_screen_order,
          "d2 screen maximum",
        ),
        q: finiteNumber(row.d2_n1_bragg_ratio_q, "d2 first-order q"),
        phiRad: finiteNumber(row.d2_n1_phi_rad, "d2 first-order phi"),
        phiDeg: finiteNumber(row.d2_n1_phi_deg, "d2 first-order phi degrees"),
        photoRadiusM: d2CaliperDiameterM / 2,
        photoRadiusMm: (d2CaliperDiameterM * 1000) / 2,
        caliperDiameterM: d2CaliperDiameterM,
      },
    };

    const expectedVoltage = 1000 + index * 10;
    const wavelength = expectedWavelength(expectedVoltage, constants);
    if (
      record.voltageV !== expectedVoltage ||
      record.voltageKv !== expectedVoltage / 1000 ||
      relativeError(record.wavelengthM, wavelength) > 5e-13 ||
      relativeError(record.wavelengthPm, wavelength * 1e12) > 5e-13
    ) {
      throw new Error(`Invalid voltage-sweep row ${index + 1}`);
    }

    for (const spacingId of ["d1", "d2"]) {
      const observed = record[spacingId];
      const expected = expectedFirstOrder(
        wavelength,
        spacings[spacingId],
        tubeRadiusM,
      );
      if (
        observed.maximumBraggOrder !== expected.maximumBraggOrder ||
        observed.maximumScreenOrder !== expected.maximumScreenOrder ||
        relativeError(observed.q, expected.q) > 5e-13 ||
        relativeError(observed.phiRad, expected.phi) > 5e-13 ||
        relativeError(observed.photoRadiusM, expected.photoRadiusM) > 5e-13 ||
        relativeError(observed.photoRadiusMm, expected.photoRadiusM * 1000) >
          5e-13 ||
        relativeError(observed.caliperDiameterM, expected.caliperDiameterM) > 5e-13
      ) {
        throw new Error(`Invalid ${spacingId} geometry at ${expectedVoltage} V`);
      }
      Object.freeze(observed);
    }

    return Object.freeze(record);
  });
}

function validateFits(rows, manifest) {
  if (rows.length !== 4) {
    throw new Error("Task 6 must contain four validation fits");
  }
  const spacingById = Object.fromEntries(
    manifest.configuration.spacings.map((spacing) => [
      spacing.identifier,
      spacing.spacing_m,
    ]),
  );

  return rows.map((row) => {
    const fit = {
      spacingId: row.spacing_id,
      fitKind: row.fit_kind,
      orderN: row.order_n ? finiteNumber(row.order_n, "fit order") : null,
      pointCount: finiteNumber(row.point_count, "fit point count"),
      gradient: finiteNumber(
        row.constrained_gradient_v_inv_sqrt,
        "fit gradient",
      ),
      intercept: finiteNumber(
        row.unconstrained_intercept_v_inv_sqrt,
        "fit intercept",
      ),
      rSquared: finiteNumber(row.r_squared, "fit R squared"),
      recoveredSpacingM: finiteNumber(
        row.recovered_spacing_m,
        "recovered spacing",
      ),
      recoveredSpacingNm: finiteNumber(
        row.recovered_spacing_nm,
        "recovered spacing in nanometres",
      ),
      maximumResidual: finiteNumber(
        row.maximum_absolute_residual_v_inv_sqrt,
        "fit residual",
      ),
    };

    if (
      !["d1", "d2"].includes(fit.spacingId) ||
      !["first_order", "all_order_normalized"].includes(fit.fitKind) ||
      relativeError(
        fit.recoveredSpacingM,
        spacingById[fit.spacingId],
      ) > 1e-12 ||
      Math.abs(1 - fit.rSquared) > 1e-12
    ) {
      throw new Error(`Invalid ${fit.spacingId} ${fit.fitKind} fit`);
    }
    return Object.freeze(fit);
  });
}

function validateAnchors(anchors, sweep, manifest) {
  if (
    anchors.schema_version !== "task06-reference-v1" ||
    anchors.reference_precision_decimal_digits !== 60 ||
    anchors.tube_radius_m !== manifest.configuration.tube_radius_m ||
    anchors.voltage_anchors?.length !== 5
  ) {
    throw new Error("Task 6 reference anchors are unsupported");
  }

  for (const anchor of anchors.voltage_anchors) {
    const index = (anchor.voltage_v - 1000) / 10;
    const row = sweep[index];
    if (
      !row ||
      relativeError(anchor.wavelength_m, row.wavelengthM) > 5e-13 ||
      anchor.spacings?.length !== 2
    ) {
      throw new Error(`Invalid reference anchor at ${anchor.voltage_v} V`);
    }
    for (const spacing of anchor.spacings) {
      const observed = row[spacing.spacing_id];
      if (
        !observed ||
        spacing.maximum_bragg_order !== observed.maximumBraggOrder ||
        spacing.maximum_screen_order !== observed.maximumScreenOrder ||
        relativeError(
          spacing.first_order_photo_radius_m,
          observed.photoRadiusM,
        ) > 5e-13
      ) {
        throw new Error(
          `Invalid ${spacing.spacing_id} anchor at ${anchor.voltage_v} V`,
        );
      }
    }
  }
}

async function fetchChecked(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${url.pathname} returned HTTP ${response.status}`);
  }
  return response;
}

export async function loadTask06Evidence() {
  const [
    sweepResponse,
    fitResponse,
    anchorResponse,
    validationResponse,
    manifestResponse,
  ] = await Promise.all([
    fetchChecked(URLS.sweep),
    fetchChecked(URLS.fits),
    fetchChecked(URLS.anchors),
    fetchChecked(URLS.validation),
    fetchChecked(URLS.manifest),
  ]);

  const [sweepText, fitText, anchors, validation, manifest] = await Promise.all([
    sweepResponse.text(),
    fitResponse.text(),
    anchorResponse.json(),
    validationResponse.json(),
    manifestResponse.json(),
  ]);

  validateManifest(manifest);
  validateReport(validation, manifest);
  const sweep = validateSweep(parseCsv(sweepText, "Voltage sweep"), manifest);
  const fits = validateFits(parseCsv(fitText, "Validation fit"), manifest);
  validateAnchors(anchors, sweep, manifest);

  return Object.freeze({
    sweep: Object.freeze(sweep),
    fits: Object.freeze(fits),
    anchors: Object.freeze(anchors),
    validation: Object.freeze(validation),
    manifest: Object.freeze(manifest),
  });
}
