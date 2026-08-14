import assert from "node:assert/strict";
import {
  angularCombination,
  coefficientNorm,
  h2MolecularOrbital,
  h3MolecularOrbital,
  hydrogenicEnergyEv,
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
