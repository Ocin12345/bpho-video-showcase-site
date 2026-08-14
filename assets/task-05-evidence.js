const URLS = {
  levels: new URL("../data/task05/energy_levels.csv", import.meta.url),
  transitions: new URL(
    "../data/task05/emission_transitions.csv",
    import.meta.url,
  ),
  limits: new URL("../data/task05/series_limits.csv", import.meta.url),
  validation: new URL(
    "../data/task05/validation_report.json",
    import.meta.url,
  ),
  manifest: new URL(
    "../data/task05/reproducibility_manifest.json",
    import.meta.url,
  ),
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

function positiveInteger(value, label) {
  const number = finiteNumber(value, label);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`${label} is not a positive integer`);
  }
  return number;
}

function relativeError(observed, expected) {
  if (expected === 0) return Math.abs(observed);
  return Math.abs(observed - expected) / Math.abs(expected);
}

function validateManifest(manifest) {
  const constants = manifest.constants;
  const scope = manifest.transition_scope;
  if (
    manifest.schema_version !== "task05-v1" ||
    manifest.output_schema_version !== "task05-data-v1" ||
    manifest.model !== "ideal stationary-nucleus Bohr hydrogen" ||
    !constants ||
    constants.planck_constant_j_s !== 6.62607015e-34 ||
    constants.speed_of_light_m_s !== 299792458 ||
    constants.elementary_charge_c !== 1.602176634e-19 ||
    constants.rydberg_constant_per_m !== 10973731.568157 ||
    !scope ||
    scope.maximum_level !== 10 ||
    scope.transition_count !== 45
  ) {
    throw new Error("Task 5 manifest is unsupported");
  }
}

function validateReport(report) {
  if (
    report.schema_version !== "task05-validation-v1" ||
    report.passed !== true ||
    !Array.isArray(report.checks) ||
    report.checks.length !== 30 ||
    !report.checks.every(
      (check) =>
        check.passed === true &&
        Number.isFinite(check.observed) &&
        Number.isFinite(check.expected) &&
        Number.isFinite(check.tolerance),
    )
  ) {
    throw new Error("The committed Task 5 validation report is not locked");
  }
}

function validateLevels(rows, manifest) {
  const rydbergEnergy = manifest.constants.rydberg_energy_ev;
  if (rows.length !== 10) throw new Error("Task 5 must contain ten levels");

  return rows.map((row, index) => {
    const level = {
      n: positiveInteger(row.n, "level n"),
      energyEv: finiteNumber(row.energy_ev, `n=${row.n} energy`),
      energyJ: finiteNumber(row.energy_j, `n=${row.n} energy in joules`),
    };

    const expectedN = index + 1;
    const expectedEnergy = -rydbergEnergy / expectedN ** 2;
    if (
      level.n !== expectedN ||
      relativeError(level.energyEv, expectedEnergy) > 5e-13 ||
      level.energyEv >= 0
    ) {
      throw new Error(`Invalid Bohr level n=${row.n}`);
    }
    return Object.freeze(level);
  });
}

function expectedRegion(wavelengthNm, manifest) {
  if (wavelengthNm < manifest.configuration.visible_min_nm) {
    return "ultraviolet";
  }
  if (wavelengthNm <= manifest.configuration.visible_max_nm) {
    return "visible";
  }
  return "infrared";
}

function validateTransitions(rows, levels, manifest) {
  if (rows.length !== 45) {
    throw new Error("Task 5 must contain exactly 45 transitions");
  }

  const constants = manifest.constants;
  const seen = new Set();
  let previousFinal = 0;
  let previousInitial = 0;

  const transitions = rows.map((row, index) => {
    const transition = {
      index,
      initialN: positiveInteger(row.initial_n, "initial n"),
      finalN: positiveInteger(row.final_n, "final n"),
      seriesName: row.series_name,
      displayGroup: row.display_group,
      lineName: row.line_name || "",
      initialEnergyEv: finiteNumber(row.initial_energy_ev, "initial energy"),
      finalEnergyEv: finiteNumber(row.final_energy_ev, "final energy"),
      photonEnergyEv: finiteNumber(row.photon_energy_ev, "photon energy"),
      photonEnergyJ: finiteNumber(row.photon_energy_j, "photon energy in joules"),
      frequencyHz: finiteNumber(row.frequency_hz, "frequency"),
      wavelengthM: finiteNumber(row.wavelength_m, "wavelength in metres"),
      wavelengthNm: finiteNumber(row.wavelength_nm, "wavelength in nanometres"),
      spectralRegion: row.spectral_region,
    };

    if (
      transition.initialN <= transition.finalN ||
      transition.initialN > 10 ||
      transition.finalN > 9
    ) {
      throw new Error(`Invalid transition pair at row ${index + 1}`);
    }

    const pair = `${transition.initialN}-${transition.finalN}`;
    if (seen.has(pair)) throw new Error(`Duplicate transition ${pair}`);
    seen.add(pair);

    if (
      transition.finalN < previousFinal ||
      (transition.finalN === previousFinal &&
        transition.initialN <= previousInitial)
    ) {
      throw new Error("Transition catalogue order is invalid");
    }
    previousFinal = transition.finalN;
    previousInitial = transition.initialN;

    const initialLevel = levels[transition.initialN - 1];
    const finalLevel = levels[transition.finalN - 1];
    const expectedEnergy = initialLevel.energyEv - finalLevel.energyEv;
    const expectedWavelength = constants.hc_ev_nm / expectedEnergy;
    const expectedFrequency =
      (expectedEnergy * constants.elementary_charge_c) /
      constants.planck_constant_j_s;

    if (
      transition.photonEnergyEv <= 0 ||
      relativeError(transition.initialEnergyEv, initialLevel.energyEv) >
        5e-13 ||
      relativeError(transition.finalEnergyEv, finalLevel.energyEv) > 5e-13 ||
      relativeError(transition.photonEnergyEv, expectedEnergy) > 5e-13 ||
      relativeError(transition.wavelengthNm, expectedWavelength) > 5e-13 ||
      relativeError(transition.frequencyHz, expectedFrequency) > 5e-13 ||
      transition.spectralRegion !==
        expectedRegion(transition.wavelengthNm, manifest)
    ) {
      throw new Error(`Transition ${pair} fails the Task 5 model`);
    }

    return Object.freeze(transition);
  });

  return transitions;
}

function validateLimits(rows, manifest) {
  const constants = manifest.constants;
  const names = ["Lyman", "Balmer", "Paschen", "Brackett", "Pfund"];
  if (rows.length !== names.length) {
    throw new Error("Task 5 must contain five analytical series limits");
  }

  return rows.map((row, index) => {
    const limit = {
      finalN: positiveInteger(row.final_n, "series-limit final n"),
      seriesName: row.series_name,
      energyEv: finiteNumber(row.limit_energy_ev, "series-limit energy"),
      wavelengthM: finiteNumber(
        row.limit_wavelength_m,
        "series-limit wavelength in metres",
      ),
      wavelengthNm: finiteNumber(
        row.limit_wavelength_nm,
        "series-limit wavelength in nanometres",
      ),
    };
    const finalN = index + 1;
    const expectedEnergy = constants.rydberg_energy_ev / finalN ** 2;
    const expectedWavelength =
      (finalN ** 2 / constants.rydberg_constant_per_m) * 1e9;
    if (
      limit.finalN !== finalN ||
      limit.seriesName !== names[index] ||
      relativeError(limit.energyEv, expectedEnergy) > 5e-13 ||
      relativeError(limit.wavelengthNm, expectedWavelength) > 5e-13
    ) {
      throw new Error(`Invalid ${names[index]} series limit`);
    }
    return Object.freeze(limit);
  });
}

function maximumNormalizedError(report) {
  return report.checks.reduce((maximum, check) => {
    if (check.comparison !== "absolute_error_lte" || check.tolerance <= 0) {
      return maximum;
    }
    return Math.max(maximum, Math.abs(check.observed) / check.tolerance);
  }, 0);
}

async function fetchChecked(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${url.pathname} returned HTTP ${response.status}`);
  }
  return response;
}

export async function loadTask05Evidence() {
  const [
    levelResponse,
    transitionResponse,
    limitResponse,
    validationResponse,
    manifestResponse,
  ] = await Promise.all([
    fetchChecked(URLS.levels),
    fetchChecked(URLS.transitions),
    fetchChecked(URLS.limits),
    fetchChecked(URLS.validation),
    fetchChecked(URLS.manifest),
  ]);

  const [levelText, transitionText, limitText, validation, manifest] =
    await Promise.all([
      levelResponse.text(),
      transitionResponse.text(),
      limitResponse.text(),
      validationResponse.json(),
      manifestResponse.json(),
    ]);

  validateManifest(manifest);
  validateReport(validation);
  const levels = validateLevels(parseCsv(levelText, "Energy level"), manifest);
  const transitions = validateTransitions(
    parseCsv(transitionText, "Emission transition"),
    levels,
    manifest,
  );
  const limits = validateLimits(
    parseCsv(limitText, "Series limit"),
    manifest,
  );

  return Object.freeze({
    levels: Object.freeze(levels),
    transitions: Object.freeze(transitions),
    limits: Object.freeze(limits),
    validation: Object.freeze(validation),
    manifest: Object.freeze(manifest),
    maximumNormalizedError: maximumNormalizedError(validation),
  });
}
