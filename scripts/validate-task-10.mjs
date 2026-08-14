import assert from "node:assert/strict";
import {
  angularCombination,
  complexAbsSquared,
  coefficientNorm,
  h2MolecularOrbital,
  h3MolecularOrbital,
  hydrogenicEnergyEv,
  hydrogenicOrbital,
  mMorphCoefficients,
  neonElectronCount,
  neonElectronDensity,
  oneSOverlap,
  orbitalNodeCounts,
  quadraticForm,
  radialWavefunction,
  sphericalHarmonic,
} from "../assets/task-10-model.js";

function simpsonIntegrate(fn, start, end, intervals = 12_000) {
  const count = intervals % 2 === 0 ? intervals : intervals + 1;
  const step = (end - start) / count;
  let sum = fn(start) + fn(end);
  for (let index = 1; index < count; index += 1) {
    sum += (index % 2 === 0 ? 2 : 4) * fn(start + index * step);
  }
  return sum * step / 3;
}

function angularInnerProduct(l, leftCoefficients, rightCoefficients = leftCoefficients) {
  const thetaSteps = 120;
  const phiSteps = 240;
  const dTheta = Math.PI / thetaSteps;
  const dPhi = 2 * Math.PI / phiSteps;
  let re = 0;
  let im = 0;
  for (let thetaIndex = 0; thetaIndex < thetaSteps; thetaIndex += 1) {
    const theta = (thetaIndex + 0.5) * dTheta;
    const weight = Math.sin(theta) * dTheta * dPhi;
    for (let phiIndex = 0; phiIndex < phiSteps; phiIndex += 1) {
      const phi = (phiIndex + 0.5) * dPhi;
      const left = angularCombination(l, leftCoefficients, theta, phi);
      const right = angularCombination(l, rightCoefficients, theta, phi);
      re += (left.re * right.re + left.im * right.im) * weight;
      im += (left.re * right.im - left.im * right.re) * weight;
    }
  }
  return { re, im };
}

function cartesianDensityGrid(n, l, m, nuclearCharge, extent, size) {
  const step = (2 * extent) / size;
  const values = [];
  let integral = 0;
  let minimum = Infinity;
  let maximum = 0;
  let invalid = 0;
  for (let zIndex = 0; zIndex < size; zIndex += 1) {
    for (let yIndex = 0; yIndex < size; yIndex += 1) {
      for (let xIndex = 0; xIndex < size; xIndex += 1) {
        const x = -extent + (xIndex + 0.5) * step;
        const y = -extent + (yIndex + 0.5) * step;
        const z = -extent + (zIndex + 0.5) * step;
        const density = complexAbsSquared(hydrogenicOrbital(n, l, m, x, y, z, nuclearCharge));
        if (!Number.isFinite(density) || density < 0) invalid += 1;
        const safeDensity = Number.isFinite(density) && density >= 0 ? density : 0;
        values.push(safeDensity);
        minimum = Math.min(minimum, safeDensity);
        maximum = Math.max(maximum, safeDensity);
        integral += safeDensity;
      }
    }
  }
  return { values, integral: integral * step ** 3, minimum, maximum, invalid };
}

const results = [];
function check(name, computed, target, tolerance) {
  assert.ok(Number.isFinite(computed), `${name}: computed value is not finite`);
  assert.ok(Math.abs(computed - target) <= tolerance, `${name}: ${computed} is not within ${tolerance} of ${target}`);
  results.push({ name, computed, target, tolerance });
}

for (const [n, l] of [[1, 0], [2, 0], [2, 1], [3, 0], [3, 1], [3, 2], [4, 0], [4, 1], [4, 2], [4, 3]]) {
  const norm = simpsonIntegrate((r) => {
    const radial = radialWavefunction(n, l, r);
    return r * r * radial * radial;
  }, 0, 180);
  check(`radial norm n=${n}, l=${l}`, norm, 1, 2e-7);
  assert.deepEqual(orbitalNodeCounts(n, l), { radial: n - l - 1, angular: l, total: n - 1 });
}

for (const nuclearCharge of [1, 2, 5, 10]) {
  const norm = simpsonIntegrate((r) => {
    const radial = radialWavefunction(3, 2, r, nuclearCharge);
    return r * r * radial * radial;
  }, 0, 180 / nuclearCharge);
  check(`hydrogenic 3d radial norm Z=${nuclearCharge}`, norm, 1, 2e-7);
  check(`hydrogenic 3d energy Z=${nuclearCharge}`, hydrogenicEnergyEv(3, nuclearCharge), -13.605693122994 * nuclearCharge ** 2 / 9, 1e-12);
}

const cartesianCases = [
  { n: 1, l: 0, m: 0, nuclearCharge: 1, extent: 16, size: 48, tolerance: 1.2e-2 },
  { n: 2, l: 1, m: 0, nuclearCharge: 1, extent: 24, size: 56, tolerance: 2e-3 },
  { n: 3, l: 2, m: 0, nuclearCharge: 1, extent: 32, size: 64, tolerance: 2e-3 },
  { n: 3, l: 2, m: 2, nuclearCharge: 1, extent: 32, size: 64, tolerance: 2e-3 },
  { n: 4, l: 3, m: 0, nuclearCharge: 1, extent: 44, size: 72, tolerance: 3e-3 },
];

for (const densityCase of cartesianCases) {
  const grid = cartesianDensityGrid(
    densityCase.n,
    densityCase.l,
    densityCase.m,
    densityCase.nuclearCharge,
    densityCase.extent,
    densityCase.size,
  );
  check(
    `3D Cartesian normalization n=${densityCase.n}, l=${densityCase.l}, m=${densityCase.m}`,
    grid.integral,
    1,
    densityCase.tolerance,
  );
  assert.equal(grid.invalid, 0, `3D density grid n=${densityCase.n}, l=${densityCase.l}, m=${densityCase.m} contains invalid values`);
  assert.ok(grid.minimum >= 0 && grid.maximum > 0, `3D density grid n=${densityCase.n}, l=${densityCase.l}, m=${densityCase.m} must be finite and non-negative`);
  const displayed = grid.values.map((value) => value / grid.maximum);
  assert.ok(displayed.every((value) => value >= 0 && value <= 1 + 1e-12), `3D display normalization n=${densityCase.n}, l=${densityCase.l}, m=${densityCase.m} must stay within 0 to 1`);
  results.push({
    name: `3D density integrity n=${densityCase.n}, l=${densityCase.l}, m=${densityCase.m}`,
    computed: 1,
    target: 1,
    tolerance: 0,
  });
}

const baseDensityGrid = cartesianDensityGrid(3, 2, 0, 1, 16, 24);
const mTwoDensityGrid = cartesianDensityGrid(3, 2, 2, 1, 16, 24);
const pDensityGrid = cartesianDensityGrid(2, 1, 0, 1, 16, 24);
function relativeGridDifference(left, right) {
  let difference = 0;
  let scale = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference += Math.abs(left[index] - right[index]);
    scale += Math.abs(left[index]) + Math.abs(right[index]);
  }
  return difference / Math.max(scale, Number.EPSILON);
}
assert.ok(relativeGridDifference(baseDensityGrid.values, mTwoDensityGrid.values) > 1e-5, "changing integer m must change the sampled 3D field");
assert.ok(relativeGridDifference(baseDensityGrid.values, pDensityGrid.values) > 1e-5, "changing n and l must change the sampled 3D field");
results.push({ name: "3D sampled field responds to n, l, and m", computed: 1, target: 1, tolerance: 0 });

for (let l = 0; l <= 3; l += 1) {
  for (let m = -l; m <= l; m += 1) {
    const norm = angularInnerProduct(l, [{ m, re: 1, im: 0 }]).re;
    check(`angular norm l=${l}, m=${m}`, norm, 1, 2.1e-4);
    if (m < l) {
      const overlap = angularInnerProduct(
        l,
        [{ m, re: 1, im: 0 }],
        [{ m: m + 1, re: 1, im: 0 }],
      );
      check(`angular overlap real l=${l}, m=${m}/${m + 1}`, overlap.re, 0, 2e-10);
      check(`angular overlap imag l=${l}, m=${m}/${m + 1}`, overlap.im, 0, 2e-10);
    }
  }
}

for (const l of [1, 2, 3]) {
  for (const path of [-l, -0.73 * l, -0.15, 0, 0.42 * l, l]) {
    for (const phase of [0, 0.7, Math.PI, 5.1]) {
      const coefficients = mMorphCoefficients(l, path, phase);
      check(`coefficient norm l=${l}, path=${path}, phase=${phase}`, coefficientNorm(coefficients), 1, 2e-14);
      check(`morph angular norm l=${l}, path=${path}, phase=${phase}`, angularInnerProduct(l, coefficients).re, 1, 2.1e-4);
    }
  }
}

check("Y00 real", sphericalHarmonic(0, 0, 0.42, 1.7).re, 1 / Math.sqrt(4 * Math.PI), 2e-15);
check("hydrogen 1s energy", hydrogenicEnergyEv(1), -13.605693122994, 1e-12);
check("hydrogen 3d energy", hydrogenicEnergyEv(3), -13.605693122994 / 9, 1e-12);
check("Ne occupation count", neonElectronCount(), 10, 0);
const neonSpatialCount = simpsonIntegrate((r) => (
  4 * Math.PI * r * r * neonElectronDensity(r, 0, 0).density
), 0, 6, 16_000);
check("Ne spatial density count", neonSpatialCount, 10, 2e-7);

for (const distance of [0.8, 1.4, 2, 3.5, 5]) {
  const bonding = h2MolecularOrbital(0, 0, 0, distance, 1);
  const antibonding = h2MolecularOrbital(0, 0, 0, distance, -1);
  check(`H2 overlap analytic agreement R=${distance}`, bonding.overlap, oneSOverlap(distance), 1e-15);
  check(`H2 bonding overlap norm R=${distance}`, 2 * (1 + bonding.overlap) / bonding.normalizationDenominator, 1, 1e-15);
  check(`H2 antibonding overlap norm R=${distance}`, 2 * (1 - antibonding.overlap) / antibonding.normalizationDenominator, 1, 1e-15);

  const h3 = h3MolecularOrbital(0, 0, 0, distance);
  check(`H3+ overlap norm R=${distance}`, quadraticForm(h3.coefficients, h3.overlap), 1, 2e-15);
}

console.log(`Task 10 physics validation: ${results.length}/${results.length} checks passed.`);
for (const result of results.filter((_, index) => index < 10)) {
  console.log(`  ${result.name}: ${result.computed.toFixed(10)}`);
}
console.log("  … plus angular, morph, energy, occupation, and LCAO overlap checks.");
