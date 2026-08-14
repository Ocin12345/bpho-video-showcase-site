/*
 * Task 10 physics kernel
 *
 * All distances are in Bohr radii (a0). Wavefunctions therefore carry the
 * corresponding atomic-unit dimensions. The module deliberately contains no
 * DOM or WebGL code so the same functions can be checked from Node.
 */

export const ELECTRON_VOLT_PER_HARTREE = 27.211386245988;
export const HYDROGEN_GROUND_ENERGY_EV = -13.605693122994;

export const EFFECTIVE_CHARGES = Object.freeze({
  neon1s: 9.7,
  neon2: 5.85,
});

const factorialCache = [1];

export function factorial(value) {
  if (!Number.isInteger(value) || value < 0) throw new RangeError("factorial expects a non-negative integer");
  for (let index = factorialCache.length; index <= value; index += 1) {
    factorialCache[index] = factorialCache[index - 1] * index;
  }
  return factorialCache[value];
}

export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function complex(re = 0, im = 0) {
  return { re, im };
}

export function complexAdd(left, right) {
  return { re: left.re + right.re, im: left.im + right.im };
}

export function complexMultiply(left, right) {
  return {
    re: left.re * right.re - left.im * right.im,
    im: left.re * right.im + left.im * right.re,
  };
}

export function complexScale(value, scale) {
  return { re: value.re * scale, im: value.im * scale };
}

export function complexAbsSquared(value) {
  return value.re * value.re + value.im * value.im;
}

export function associatedLaguerre(order, alpha, x) {
  if (!Number.isInteger(order) || order < 0) throw new RangeError("Laguerre order must be a non-negative integer");
  if (order === 0) return 1;
  if (order === 1) return 1 + alpha - x;
  let previousPrevious = 1;
  let previous = 1 + alpha - x;
  for (let index = 2; index <= order; index += 1) {
    const current = ((2 * index - 1 + alpha - x) * previous - (index - 1 + alpha) * previousPrevious) / index;
    previousPrevious = previous;
    previous = current;
  }
  return previous;
}

export function associatedLegendre(l, m, x) {
  if (!Number.isInteger(l) || !Number.isInteger(m) || l < 0 || m < 0 || m > l) {
    throw new RangeError("associatedLegendre expects integers with 0 <= m <= l");
  }
  const boundedX = clamp(x, -1, 1);
  let pmm = 1;
  if (m > 0) {
    const root = Math.sqrt(Math.max(0, 1 - boundedX * boundedX));
    let factor = 1;
    for (let index = 1; index <= m; index += 1) {
      pmm *= -factor * root;
      factor += 2;
    }
  }
  if (l === m) return pmm;
  let pmmp1 = boundedX * (2 * m + 1) * pmm;
  if (l === m + 1) return pmmp1;
  for (let degree = m + 2; degree <= l; degree += 1) {
    const pll = ((2 * degree - 1) * boundedX * pmmp1 - (degree + m - 1) * pmm) / (degree - m);
    pmm = pmmp1;
    pmmp1 = pll;
  }
  return pmmp1;
}

export function sphericalHarmonic(l, m, theta, phi) {
  if (!Number.isInteger(l) || !Number.isInteger(m) || l < 0 || Math.abs(m) > l) {
    throw new RangeError("sphericalHarmonic expects l >= 0 and -l <= m <= l");
  }
  if (m < 0) {
    const positive = sphericalHarmonic(l, -m, theta, phi);
    const parity = (-m) % 2 === 0 ? 1 : -1;
    return { re: parity * positive.re, im: -parity * positive.im };
  }
  const normalization = Math.sqrt(
    ((2 * l + 1) / (4 * Math.PI)) * (factorial(l - m) / factorial(l + m)),
  );
  const legendre = associatedLegendre(l, m, Math.cos(theta));
  const amplitude = normalization * legendre;
  return {
    re: amplitude * Math.cos(m * phi),
    im: amplitude * Math.sin(m * phi),
  };
}

export function radialWavefunction(n, l, r, nuclearCharge = 1) {
  if (!Number.isInteger(n) || !Number.isInteger(l) || n < 1 || l < 0 || l >= n) {
    throw new RangeError("radialWavefunction expects n >= 1 and 0 <= l < n");
  }
  if (!(nuclearCharge > 0) || r < 0) return 0;
  const rho = (2 * nuclearCharge * r) / n;
  const normalization = Math.sqrt(
    ((2 * nuclearCharge / n) ** 3 * factorial(n - l - 1)) /
      (2 * n * factorial(n + l)),
  );
  return normalization * Math.exp(-rho / 2) * rho ** l * associatedLaguerre(n - l - 1, 2 * l + 1, rho);
}

export function hydrogenicOrbital(n, l, m, x, y, z, nuclearCharge = 1, centre = { x: 0, y: 0, z: 0 }) {
  const dx = x - centre.x;
  const dy = y - centre.y;
  const dz = z - centre.z;
  const r = Math.hypot(dx, dy, dz);
  const theta = r > 1e-14 ? Math.acos(clamp(dz / r, -1, 1)) : 0;
  const phi = Math.atan2(dy, dx);
  return complexScale(sphericalHarmonic(l, m, theta, phi), radialWavefunction(n, l, r, nuclearCharge));
}

export function hydrogenicEnergyEv(n, nuclearCharge = 1) {
  return (HYDROGEN_GROUND_ENERGY_EV * nuclearCharge * nuclearCharge) / (n * n);
}

export function orbitalNodeCounts(n, l) {
  return {
    radial: n - l - 1,
    angular: l,
    total: n - 1,
  };
}

export function mMorphCoefficients(l, pathValue, relativePhase = 0) {
  if (!Number.isInteger(l) || l < 0) throw new RangeError("l must be a non-negative integer");
  const bounded = clamp(pathValue, -l, l);
  const nearest = Math.round(bounded);
  if (Math.abs(bounded - nearest) < 1e-10 || l === 0) {
    return [{ m: nearest, re: 1, im: 0 }];
  }
  const lower = Math.floor(bounded);
  const upper = lower + 1;
  const progress = bounded - lower;
  const angle = progress * Math.PI / 2;
  return [
    { m: lower, re: Math.cos(angle), im: 0 },
    {
      m: upper,
      re: Math.sin(angle) * Math.cos(relativePhase),
      im: Math.sin(angle) * Math.sin(relativePhase),
    },
  ];
}

export function coefficientNorm(coefficients) {
  return coefficients.reduce((sum, coefficient) => sum + coefficient.re ** 2 + coefficient.im ** 2, 0);
}

export function angularCombination(l, coefficients, theta, phi) {
  return coefficients.reduce((sum, coefficient) => {
    const basis = sphericalHarmonic(l, coefficient.m, theta, phi);
    return complexAdd(sum, complexMultiply(coefficient, basis));
  }, complex());
}

export function morphOrbital(n, l, pathValue, relativePhase, x, y, z, nuclearCharge = 1) {
  const r = Math.hypot(x, y, z);
  const theta = r > 1e-14 ? Math.acos(clamp(z / r, -1, 1)) : 0;
  const phi = Math.atan2(y, x);
  const angular = angularCombination(l, mMorphCoefficients(l, pathValue, relativePhase), theta, phi);
  return complexScale(angular, radialWavefunction(n, l, r, nuclearCharge));
}

export function oneSOverlap(distance, nuclearCharge = 1) {
  const scaled = Math.max(0, distance) * nuclearCharge;
  return Math.exp(-scaled) * (1 + scaled + scaled * scaled / 3);
}

export function h2Centres(distance) {
  return [
    { x: -distance / 2, y: 0, z: 0, label: "Hᴀ" },
    { x: distance / 2, y: 0, z: 0, label: "Hʙ" },
  ];
}

export function h2MolecularOrbital(x, y, z, distance = 2, parity = 1, nuclearCharge = 1) {
  const sign = parity >= 0 ? 1 : -1;
  const centres = h2Centres(distance);
  const left = hydrogenicOrbital(1, 0, 0, x, y, z, nuclearCharge, centres[0]).re;
  const right = hydrogenicOrbital(1, 0, 0, x, y, z, nuclearCharge, centres[1]).re;
  const overlap = oneSOverlap(distance, nuclearCharge);
  const normalizationDenominator = 2 * (1 + sign * overlap);
  const psi = (left + sign * right) / Math.sqrt(normalizationDenominator);
  return {
    psi: { re: psi, im: 0 },
    density: 2 * psi * psi,
    overlap,
    normalizationDenominator,
    centres,
  };
}

export function h3Centres(distance) {
  const radius = distance / Math.sqrt(3);
  return [
    { x: 0, y: radius, z: 0, label: "Hᴀ" },
    { x: -distance / 2, y: -radius / 2, z: 0, label: "Hʙ" },
    { x: distance / 2, y: -radius / 2, z: 0, label: "Hᴄ" },
  ];
}

export function distanceBetween(left, right) {
  return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);
}

export function overlapMatrix(centres, nuclearCharge = 1) {
  return centres.map((left, row) => centres.map((right, column) => (
    row === column ? 1 : oneSOverlap(distanceBetween(left, right), nuclearCharge)
  )));
}

export function quadraticForm(coefficients, matrix) {
  let value = 0;
  for (let row = 0; row < coefficients.length; row += 1) {
    for (let column = 0; column < coefficients.length; column += 1) {
      value += coefficients[row] * matrix[row][column] * coefficients[column];
    }
  }
  return value;
}

export function normalizeRealCoefficients(coefficients, matrix) {
  const normSquared = quadraticForm(coefficients, matrix);
  if (!(normSquared > 0)) throw new RangeError("coefficient overlap norm must be positive");
  const scale = 1 / Math.sqrt(normSquared);
  return {
    coefficients: coefficients.map((value) => value * scale),
    rawNormSquared: normSquared,
  };
}

export function h3MolecularOrbital(x, y, z, distance = 2, nuclearCharge = 1) {
  const centres = h3Centres(distance);
  const matrix = overlapMatrix(centres, nuclearCharge);
  const normalized = normalizeRealCoefficients([1, 1, 1], matrix);
  let psi = 0;
  centres.forEach((centre, index) => {
    psi += normalized.coefficients[index] * hydrogenicOrbital(1, 0, 0, x, y, z, nuclearCharge, centre).re;
  });
  return {
    psi: { re: psi, im: 0 },
    density: 2 * psi * psi,
    centres,
    overlap: matrix,
    coefficients: normalized.coefficients,
    rawNormSquared: normalized.rawNormSquared,
  };
}

export const NEON_ORBITALS = Object.freeze([
  { key: "1s", n: 1, l: 0, m: 0, occupation: 2, nuclearCharge: EFFECTIVE_CHARGES.neon1s, shell: "core" },
  { key: "2s", n: 2, l: 0, m: 0, occupation: 2, nuclearCharge: EFFECTIVE_CHARGES.neon2, shell: "valence" },
  { key: "2p−1", n: 2, l: 1, m: -1, occupation: 2, nuclearCharge: EFFECTIVE_CHARGES.neon2, shell: "valence" },
  { key: "2p0", n: 2, l: 1, m: 0, occupation: 2, nuclearCharge: EFFECTIVE_CHARGES.neon2, shell: "valence" },
  { key: "2p+1", n: 2, l: 1, m: 1, occupation: 2, nuclearCharge: EFFECTIVE_CHARGES.neon2, shell: "valence" },
]);

export function neonElectronDensity(x, y, z) {
  let core = 0;
  let valence = 0;
  for (const orbital of NEON_ORBITALS) {
    const psi = hydrogenicOrbital(
      orbital.n,
      orbital.l,
      orbital.m,
      x,
      y,
      z,
      orbital.nuclearCharge,
    );
    const contribution = orbital.occupation * complexAbsSquared(psi);
    if (orbital.shell === "core") core += contribution;
    else valence += contribution;
  }
  return { density: core + valence, core, valence };
}

export function neonElectronCount() {
  return NEON_ORBITALS.reduce((sum, orbital) => sum + orbital.occupation, 0);
}

export function formatOrbital(n, l, m) {
  const letters = ["s", "p", "d", "f", "g"];
  return `${n}${letters[l] ?? `l${l}`} (m = ${m > 0 ? "+" : ""}${m})`;
}
